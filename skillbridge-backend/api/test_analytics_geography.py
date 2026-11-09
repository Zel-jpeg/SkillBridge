from types import SimpleNamespace
from django.test import SimpleTestCase
from .analytics_geography import area_identity, placement_geography


class GeographyTests(SimpleTestCase):
    def test_qualified_names_and_independent_city(self):
        self.assertEqual(area_identity({'province': 'Davao del Norte', 'city': 'Panabo City'}), ('1102300000', '1102315000'))
        self.assertEqual(area_identity({'city': 'Davao City'}), ('1130700000', '1130700000'))
        self.assertEqual(area_identity({'province': 'Davao del Sur', 'city': 'Davao City'}), ('1130700000', '1130700000'))
        self.assertEqual(area_identity({'city': 'Carmen'}), ('', ''))
        self.assertEqual(area_identity({'province': 'Davao del Norte'}), ('1102300000', ''))
        self.assertEqual(area_identity({'province': 'Foreign province', 'city': 'Carmen'}), ('', ''))
        self.assertEqual(area_identity({'province': 'Cebu'}), ('0702200000', ''))
        self.assertEqual(area_identity({'province': 'Cebu', 'city': 'Lapu-Lapu City'}), ('0731100000', '0731100000'))
        self.assertEqual(area_identity({'province': 'Camarines Sur', 'city': 'Naga City'}), ('0501724000', '0501724000'))

    def test_weights_missing_pins_and_approval_qualification(self):
        companies = {
            1: SimpleNamespace(id=1, name='Pinned', address={'province': 'Davao del Norte', 'city': 'Panabo'}, location_lat=7.3, location_lng=125.6),
            2: SimpleNamespace(id=2, name='Unpinned', address={'city': 'Davao City'}, location_lat=None, location_lng=None),
            3: SimpleNamespace(id=3, name='Invalid', address={}, location_lat=float('nan'), location_lng=125),
        }
        rows = [{'company_id': key, 'placement_status': 'approved'} for key in (1, 1, 2, 3)]
        rows.append({'company_id': 1, 'placement_status': 'approved_other_batch'})
        geo = placement_geography(rows, companies)
        self.assertEqual(geo['approved_students'], 4)
        self.assertEqual(geo['points'][0]['count'], 2)
        self.assertEqual(geo['coverage']['pins'], {'mapped': 2, 'missing': 1, 'invalid': 1})
        self.assertEqual(geo['coverage']['areas']['city'], {'matched': 3, 'unresolved': 1})
        self.assertEqual(rows[2]['partner_province_id'], '1130700000')
        self.assertNotIn('partner_city_id', rows[-1])
