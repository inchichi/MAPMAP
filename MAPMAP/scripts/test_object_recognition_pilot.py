import importlib.util
import unittest
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location('pilot', Path(__file__).with_name('object-recognition-pilot.py'))
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class EvidenceTests(unittest.TestCase):
    def test_edge_context_is_clipped_without_moving_target(self):
        source = Image.new('RGBA', (16, 16), (100, 80, 60, 255))
        world = Image.new('RGBA', (100, 100), (0, 120, 0, 255))
        before = source.tobytes(), world.tobytes()
        crop, context, coordinates = pilot.evidence(source, world, 0, 0)
        self.assertEqual(coordinates['native_target'], [0, 0, 16, 16])
        self.assertEqual(coordinates['context_origin'], [0, 0])
        self.assertEqual(context.getpixel((0, 0)), (255, 30, 30))
        self.assertEqual(crop.size, (192, 192))
        self.assertEqual(before, (source.tobytes(), world.tobytes()))

    def test_invalid_placement_is_rejected(self):
        source = Image.new('RGBA', (16, 16))
        world = Image.new('RGBA', (32, 32))
        with self.assertRaises(ValueError): pilot.evidence(source, world, 20, 20)


if __name__ == '__main__': unittest.main()
