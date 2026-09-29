"""Synthetic component matrix and mocked real-page checks. No backend server or live writes."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).parent / ".runtime"))
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:5174"
ARTIFACTS = Path(__file__).parent / "artifacts" / "student-modal"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks = []
errors = []
TABS = ["Overview", "Assessments", "Combined competency", "Recommendations", "Retake history"]

def record(name):
    checks.append(name)

def select_tab(page, name):
    page.get_by_role("tab", name=re.compile("^" + re.escape(name))).click()

def geometry(page, width):
    dialog = page.locator("dialog[open]").first
    rect = dialog.bounding_box()
    height = page.viewport_size["height"]
    assert rect["x"] >= -1 and rect["y"] >= -1 and rect["x"] + rect["width"] <= width + 1 and rect["y"] + rect["height"] <= height + 1, rect
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Document horizontal overflow"
    close = dialog.get_by_role("button", name="Close student details")
    c = close.bounding_box()
    assert c["width"] >= 44 and c["height"] >= 44 and c["y"] >= rect["y"] and c["y"] + c["height"] <= rect["y"] + rect["height"]
    assert page.evaluate("document.body.style.overflow") == "hidden"
    assert dialog.evaluate("el => el.scrollHeight <= el.clientHeight + 1"), "Dialog itself scrolls"
    # Tabs intentionally scroll horizontally; score and recommendation text must wrap.
    assert page.locator(".sb-detail-panel:not([hidden])").evaluate("el => el.scrollWidth <= el.clientWidth + 1"), "Panel horizontal overflow"
    assert page.locator(".sb-detail-tabs").evaluate("el => el.getBoundingClientRect().bottom <= innerHeight"), "Tabs offscreen"
    return rect

def screenshot(page, name):
    page.screenshot(path=str(ARTIFACTS / (name + ".png")), full_page=False)

def fixture(page, scenario="complete", mode="instructor", width=1366, dark=False):
    page.set_viewport_size({"width": width, "height": {375: 812, 768: 1024, 1024: 768, 1366: 900}[width]})
    page.goto(BASE + "/tests/student-modal/index.html?scenario=" + scenario + "&mode=" + mode)
    page.wait_for_load_state("networkidle")
    if dark:
        page.evaluate("document.documentElement.classList.add('dark')")
    if mode != "inline":
        page.get_by_role("button", name="Open details", exact=True).click()
        expect(page.locator("dialog[open]")).to_have_count(1)
    return page.locator("dialog[open]").first

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    context = browser.new_context(reduced_motion="reduce")
    page = context.new_page()
    page.set_default_timeout(10000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    for width in [375, 768, 1024, 1366]:
        for dark in [False, True]:
            fixture(page, width=width, dark=dark)
            initial = geometry(page, width)
            screenshot(page, f"overview-{width}-{'dark' if dark else 'light'}")
            for tab in TABS[1:]:
                select_tab(page, tab)
                assert geometry(page, width) == initial, "Modal resizes on tab change"
                if width == 1366 and not dark:
                    screenshot(page, tab.lower().replace(" ", "-"))
            text = page.locator("dialog[open]").inner_text()
            assert "RESTRICTED_ANSWER_KEY_SENTINEL" not in text
            select_tab(page, "Assessments")
            scroll = page.locator(".sb-detail-panels")
            assert scroll.evaluate("el => el.scrollHeight > el.clientHeight")
            header_y = page.locator(".sb-detail-header").bounding_box()["y"]
            tab_y = page.locator(".sb-detail-tabs").bounding_box()["y"]
            scroll.evaluate("el => el.scrollTop = el.scrollHeight")
            assert page.locator(".sb-detail-header").bounding_box()["y"] == header_y
            assert page.locator(".sb-detail-tabs").bounding_box()["y"] == tab_y
            page.get_by_role("button", name="Close student details").click()
            expect(page.locator("#open-detail")).to_be_focused()
            assert page.evaluate("document.body.style.overflow") == ""
            record(f"{width}px {'dark' if dark else 'light'}: five panels, stable geometry, independent scroll, fixed header/tabs, close, restoration")

    fixture(page)
    overview = page.get_by_role("tab", name="Overview", exact=True)
    overview.focus()
    page.keyboard.press("ArrowRight")
    expect(page.get_by_role("tab", name=re.compile("^Assessments"))).to_be_focused()
    page.keyboard.press("End")
    expect(page.get_by_role("tab", name=re.compile("^Retake history"))).to_be_focused()
    page.keyboard.press("Home")
    expect(overview).to_be_focused()
    page.keyboard.press("ArrowLeft")
    expect(page.get_by_role("tab", name=re.compile("^Retake history"))).to_be_focused()
    assert page.locator('[role="tab"][tabindex="0"]').count() == 1
    assert page.locator('[role="tab"][aria-selected="true"]').evaluate("el => document.getElementById(el.getAttribute('aria-controls')).getAttribute('aria-labelledby') === el.id")
    for _ in range(30):
        page.keyboard.press("Tab")
        assert page.locator("dialog[open]").evaluate("el => el.contains(document.activeElement)"), "Focus escaped"
    page.keyboard.press("Escape")
    expect(page.locator("dialog[open]")).to_have_count(0)
    expect(page.locator("#open-detail")).to_be_focused()
    record("Roving tabs: arrows/Home/End, ARIA relationships, focus trap, Escape and focus restoration")

    fixture(page)
    page.mouse.click(2, 2)
    expect(page.locator("dialog[open]")).to_have_count(0)
    fixture(page)
    rect = page.locator("dialog[open]").bounding_box()
    page.mouse.move(rect["x"] + 80, rect["y"] + 20)
    page.mouse.down()
    page.mouse.move(2, 2)
    page.mouse.up()
    expect(page.locator("dialog[open]")).to_have_count(1)
    record("Backdrop closes; pointer starting inside and ending outside keeps dialog open")

    for scenario in ["locked", "pending", "empty", "no-required", "archived", "flagged", "no-recommendations", "approved"]:
        fixture(page, scenario=scenario, width=375)
        geometry(page, 375)
        if scenario in ["locked", "pending", "empty", "no-required", "archived", "flagged"]:
            for tab in ["Combined competency", "Recommendations"]:
                select_tab(page, tab)
                expect(page.get_by_role("heading", name=re.compile("is locked|are locked"))).to_be_visible()
            text = page.locator("dialog[open]").inner_text()
            for sentinel in ["LOCKED_PROFILE_SENTINEL", "LOCKED_RECOMMENDATION_SENTINEL", "STALE_RECOMMENDATION_SENTINEL"]:
                assert sentinel not in text
        if scenario in ["empty", "no-required"]:
            select_tab(page, "Overview")
            expect(page.get_by_role("progressbar")).to_have_count(0)
            select_tab(page, "Assessments")
            if scenario == "empty":
                expect(page.get_by_role("heading", name="No assessments assigned")).to_be_visible()
            if scenario == "empty":
                select_tab(page, "Retake history")
                expect(page.get_by_role("heading", name="No archived attempts")).to_be_visible()
        if scenario == "archived":
            select_tab(page, "Assessments")
            expect(page.get_by_role("button", name=re.compile("Approve retake for|Revoke retake for"))).to_have_count(0)
        if scenario == "flagged":
            select_tab(page, "Assessments")
            expect(page.get_by_text(re.compile("Submitted attempt flagged for integrity review"))).to_be_visible()
        if scenario == "no-recommendations":
            select_tab(page, "Recommendations")
            expect(page.get_by_role("heading", name="No eligible positions available")).to_be_visible()
        if scenario == "approved":
            select_tab(page, "Overview")
            expect(page.get_by_text("Approved OJT placement", exact=True)).to_be_visible()
            screenshot(page, "approved-placement-mobile")
            select_tab(page, "Recommendations")
            expect(page.get_by_text("Current approved placement", exact=True)).to_be_visible()
        if scenario == "locked":
            screenshot(page, "locked-mobile")
        record(f"375px scenario: {scenario}")

    fixture(page)
    select_tab(page, "Recommendations")
    assert "STALE_RECOMMENDATION_SENTINEL" not in page.locator("dialog[open]").inner_text()
    label = page.get_by_role("button", name="NLP fit: explanation").first
    label.focus()
    expect(page.get_by_role("tooltip")).to_be_visible()
    assert page.get_by_role("tooltip").evaluate("el => !!el.closest('dialog')")
    select_tab(page, "Retake history")
    expect(page.get_by_text("Archived attempt 1", exact=True)).to_be_visible()
    expect(page.locator('.sb-detail-panel:not([hidden])').get_by_text("Software development and enterprise application architecture", exact=True)).to_have_count(2)
    assert "RESTRICTED_ANSWER_KEY_SENTINEL" not in page.locator("dialog[open]").inner_text()
    record("Score explanation in native top layer; history IDs resolve category names; restricted answers never rendered")

    for width in [375, 1366]:
        fixture(page, width=width)
        select_tab(page, "Assessments")
        approve = page.get_by_role("button", name=re.compile("^Approve retake for Applied"))
        approve.click()
        expect(page.locator("dialog[open]")).to_have_count(2)
        screenshot(page, f"nested-retake-{width}")
        confirm = page.locator("dialog[open]").last
        assert confirm.bounding_box()['height'] < 600, 'Confirmation has excess empty height'
        for _ in range(12):
            page.keyboard.press("Tab")
            assert confirm.evaluate("el => el.contains(document.activeElement)")
        page.keyboard.press("Escape")
        expect(page.locator("dialog[open]")).to_have_count(1)
        expect(approve).to_be_focused()
        assert page.evaluate("document.body.style.overflow") == "hidden"
        approve.click()
        page.mouse.click(2, 2)
        expect(page.locator("dialog[open]")).to_have_count(1)
        approve.click()
        page.locator("dialog[open]").last.get_by_role("button", name="Approve retake", exact=True).click()
        expect(page.locator("output")).to_have_text("retake:9001:101")
        revoke = page.get_by_role("button", name=re.compile("^Revoke retake for Applied"))
        expect(revoke).to_be_visible()
        revoke.click()
        page.locator("dialog[open]").last.get_by_role("button", name="Revoke", exact=True).click()
        expect(approve).to_be_visible()
        record(f"{width}px nested confirmation: focus trap, Escape/backdrop preserves parent, body lock, exact-assessment approval/revocation updates")

    fixture(page, mode="dashboard")
    select_tab(page, "Assessments")
    expect(page.get_by_role("button", name=re.compile("Approve retake for|Revoke retake for"))).to_have_count(0)
    assert page.get_by_text("Archived", exact=True).count() == 0
    record("Dashboard explicitly read-only without incorrectly marking student archived")

    fixture(page, mode="admin")
    expect(page.get_by_role("button", name="Remove student")).to_be_visible()
    select_tab(page, "Assessments")
    expect(page.get_by_role("button", name="Remove student")).to_be_visible()
    page.get_by_role("button", name="Remove student").click()
    expect(page.locator("output")).to_have_text("remove")
    fixture(page, mode="admin-instructor")
    expect(page.get_by_role("tab")).to_have_count(0)
    page.get_by_role("button", name="Edit instructor").click()
    page.get_by_label("name", exact=True).fill("Changed QA Instructor")
    page.get_by_role("button", name="Cancel", exact=True).click()
    page.get_by_role("button", name="Edit instructor").click()
    expect(page.get_by_label("name", exact=True)).to_have_value("QA Instructor")
    page.get_by_label("name", exact=True).fill("Saved QA Instructor")
    page.get_by_role("button", name="Save changes").click()
    expect(page.locator("output")).to_have_text("saved:Saved QA Instructor")
    record("Admin student footer; instructor edit/save/cancel without student tabs")

    fixture(page, mode="inline", width=768)
    assert not page.locator("dialog[open]").count()
    detail = page.locator(".sb-student-detail")
    assert detail.bounding_box()["height"] < 650
    assert page.evaluate("document.body.style.overflow") == ""
    select_tab(page, "Assessments")
    assert page.locator(".sb-detail-panels").evaluate("el => getComputedStyle(el).overflowY") != "auto"
    record("Compact inline details have natural height and do not lock page scroll")

    fixture(page)
    page.locator('#expire-session').evaluate('el => el.click()')
    expect(page.locator('dialog[open]')).to_have_count(0)
    expect(page.get_by_role('heading', name='Session Expired')).to_be_visible()
    assert page.evaluate('document.body.style.overflow') == ''
    record('Session expiry removes native top-layer details and releases the body lock')

    # Actual authenticated page integrations: every API request is intercepted.
    api_student = {
        "id": 9001, "name": "QA Integration Student", "student_name": "QA Integration Student", "student_id": "QA-001", "school_id": "QA-001",
        "email": "qa.integration@example.invalid", "course": "BSIT", "has_submitted": True, "all_required_completed": True,
        "completed_required_count": 1, "total_required_count": 1, "remaining_required_count": 0, "recommendations_locked": False,
        "batch": {"id": 77, "name": "QA Batch"}, "instructor": "QA Instructor", "placement": {"status": "unplaced"},
        "assessment_results": [{"id": 101, "title": "QA Integration Assessment", "is_required": True, "include_in_competency": True, "attempt_status": "submitted", "submitted_at": "2026-09-20T04:00:00Z", "category_scores": [{"category_id": 1, "category": "Programming", "raw_score": 8, "max_score": 10, "percentage": 80}], "prior_attempts": [], "retake_allowed": False}],
        "skill_scores": {"Programming": 80}, "combined_category_scores": [], "combined_competency_profile": {"orientation_label": "QA profile", "orientation_summary": "QA summary", "development_suggestions": [], "model_used": "regex", "finalized_at": "2026-09-20T04:00:00Z"}, "top_recommendations": [],
    }
    instr = {"id": 9002, "name": "QA Integration Instructor", "email": "qa.instructor@example.invalid", "instructor_id": "QA-IN-001", "department": "Computing", "courses": "BSIT"}
    mutations = []
    get_requests = []
    def api_route(route):
        request = route.request
        path = urlparse(request.url).path
        # Vite source modules also live under /src/api/: leave those untouched.
        if not path.startswith('/api/'):
            route.continue_()
            return
        if request.method == 'GET' and not path.endswith('/events/'):
            get_requests.append(path)
        if request.method == "OPTIONS":
            payload = {}
        elif request.method == "PATCH":
            body = request.post_data_json
            mutations.append(body)
            api_student["assessment_results"][0]["retake_allowed"] = body["retake_allowed"]
            payload = {"ok": True}
        elif path.endswith("/batches/77/students/"):
            payload = {"batch": api_student["batch"], "students": [api_student]}
        elif path.endswith("/batches/"):
            payload = [{"id": 77, "name": "QA Batch", "status": "active", "student_count": 1}]
        elif path.endswith("/students/recommendations/"):
            payload = [api_student]
        elif path.endswith("/admin/users/"):
            payload = {"students": [api_student], "instructors": [instr], "pending_instructors": []}
        elif path.endswith("/me/"):
            payload = {"id": 999, "name": "QA Instructor", "role": "instructor", "email": "qa@example.invalid"}
        else:
            payload = []
        route.fulfill(status=200, content_type="application/json", body=json.dumps(payload), headers={"Access-Control-Allow-Origin": BASE, "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"})
    page.route("**/api/**", api_route)
    page.set_viewport_size({"width": 1366, "height": 900})
    for role, path in [("instructor", "/instructor/students"), ("instructor", "/instructor/dashboard"), ("admin", "/admin/users")]:
        page.goto(BASE)
        page.evaluate("(role) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('sb-token','synthetic-qa-only'); localStorage.setItem('sb-role',role); localStorage.setItem('sb-user',JSON.stringify({name:'QA Instructor',role,email:'qa@example.invalid'})); }", role)
        page.goto(BASE + path)
        page.wait_for_load_state("networkidle")
        opener = page.get_by_text("QA Integration Student", exact=True).filter(visible=True).first
        if not opener.count():
            screenshot(page, 'integration-debug')
            print(json.dumps({'url': page.url, 'body': page.locator('body').inner_text(), 'get_requests': get_requests}, indent=2))
        opener.click()
        expect(page.get_by_role("dialog")).to_have_count(1)
        expect(page.get_by_text("QA Batch", exact=True).last).to_be_visible()
        screenshot(page, "integration-" + path.split("/")[-1] + "-" + role)
        requests_before_tabs = len(get_requests)
        for tab in TABS:
            select_tab(page, tab)
        assert len(get_requests) == requests_before_tabs, 'Tab switching refetched student data'
        select_tab(page, "Assessments")
        if path != "/instructor/dashboard":
            page.get_by_role("button", name="Approve retake for QA Integration Assessment").click()
            page.locator("dialog[open]").last.get_by_role("button", name="Approve retake", exact=True).click()
            expect(page.get_by_role("button", name="Revoke retake for QA Integration Assessment")).to_be_visible()
            assert mutations[-1] == {"retake_allowed": True, "assessment_id": 101}
            page.get_by_role("button", name="Revoke retake for QA Integration Assessment").click()
            page.locator("dialog[open]").last.get_by_role("button", name="Revoke", exact=True).click()
            expect(page.get_by_role("button", name="Approve retake for QA Integration Assessment")).to_be_visible()
        else:
            expect(page.get_by_role("button", name=re.compile("Approve retake for|Revoke retake for"))).to_have_count(0)
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog")).to_have_count(0)
        assert page.evaluate("document.activeElement.getAttribute('aria-haspopup')") == "dialog"
        record(f"Mocked scoped endpoint integration {path}: normalization, batch, controls, synchronization, focus restoration")

    page.get_by_role("button", name=re.compile("^Instructors")).click()
    page.get_by_text("QA Integration Instructor", exact=True).filter(visible=True).first.click()
    expect(page.get_by_role("tab")).to_have_count(0)
    page.get_by_role("button", name="Edit instructor").click()
    page.get_by_role("button", name="Cancel", exact=True).click()
    page.get_by_role("button", name="Remove instructor").click()
    expect(page.get_by_role("dialog", name="Remove instructor?")).to_be_visible()
    page.get_by_role("button", name="Cancel", exact=True).click()
    record("Actual admin instructor modal retains edit and remove confirmation flow")

    assert not errors, errors
    (ARTIFACTS / "results.json").write_text(json.dumps({"checks": checks, "page_errors": errors, "screenshots": sorted(f.name for f in ARTIFACTS.glob("*.png"))}, indent=2))
    print(json.dumps({"passed_groups": len(checks), "checks": checks, "page_errors": errors, "artifacts": str(ARTIFACTS.resolve())}, indent=2))
    browser.close()
