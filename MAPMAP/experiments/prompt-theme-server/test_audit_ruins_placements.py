import unittest
import numpy as np
from audit_ruins_placements import overlap, outside


class PlacementAuditTests(unittest.TestCase):
    def test_separated(self):
        a = np.ones((2, 2), dtype=bool)
        self.assertEqual(overlap(a, 0, 0, a, 2, 0), 0)

    def test_exact_alpha_overlap(self):
        a = np.array([[True, False], [False, False]])
        self.assertEqual(overlap(a, 0, 0, a, 0, 0), 1)
        self.assertEqual(overlap(a, 0, 0, a, 1, 0), 0)

    def test_boundary_counts_only_opaque(self):
        a = np.array([[False, True], [True, True]])
        self.assertEqual(outside(a, -1, 0, 4, 4), 1)
        self.assertEqual(outside(a, 3, 3, 4, 4), 3)


if __name__ == '__main__':
    unittest.main()
