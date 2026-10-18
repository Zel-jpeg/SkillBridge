# Accepted local browser matrix

The user accepted desktop Chrome and Edge at1280×900, and Chrome tablet768×1024
and phone390×844 emulation. These are installed headless browsers and emulated
touch/viewport profiles, not physical phones/tablets or Safari/Firefox acceptance.

`work/defense_audit/v07_matrix.py` uses a dedicated disposable localhost PostgreSQL
database and real Django/JWT/React calls. Google/email/address/map providers are
mocked; no live data/provider configuration is accessed. Each matrix case passes
four groups in `v07-matrix-progress2.txt` and `v07-artifacts/results.json`:

- Expired access renews with a real refresh token. The admin imports/reviews
  synthetic records in the confirmed IAMS layout and downloads the actual XLSX
  template. Tab focus stays inside the dialog; Escape closes it; page width fits.
- Actual PDF/XLSX report downloads work at each accepted viewport/browser.
- A denied map script offers retry. An aborted profile write retains the edited
  phone and truthful uncertainty message. Explicit retry saves through the real
  API; refresh shows the saved value. Layout remains contained.
- Desktop Chrome/Edge enter real fullscreen, render the timer/question and retain
  the answer draft. Exiting fullscreen records a flagged stop and saved answer.
  Emulated tablet/phone use the mobile integrity flow and submit normally.

`v07-mobile-loaded-final.txt` and `v07-artifacts/mobile-results.json` additionally
wait for the actual assessment title/category scores before capturing final
mobile result screens. This corrects the original screenshot timing, which caught
a loading skeleton. Desktop stop and loaded phone result screenshots were viewed.
All cases report zero page errors and assert no generic ErrorBoundary screen.

`v07-session-regression.txt` passes six real-token renewal/expired-refresh/logout/
uncertain-write/draft ownership groups. V01 timing and P02 enrollment evidence
also covers interrupted submission, server deadlines, expired-attempt review,
multi-width review tables, editing/re-preview, duplicate prevention and keyboard
focus. V01 current-format text/CSV question uploads are retained; official LMS
file comparison remains a later follow-up under the user's final-format decision;
see [accepted import format](QUESTION_IMPORT_FORMAT.md).

The initial matrix stopped at profile validation because its test fixture used
flat form-input keys instead of the saved nested address shape. The fixture was
corrected; no application validation was relaxed. Session initialization now runs
once per browser context rather than resetting its access token on every reload.
The earlier V01 fullscreen timeout while other browser fixtures ran did not recur
in this sequential matrix. It is not counted as passing evidence. No application
behavior changed for V07; hosted policy and physical-device checks remain outside
this accepted local matrix.
