import unittest
import tempfile
from pathlib import Path
from unittest.mock import Mock,patch
from PIL import Image
from decoration_routes import plan_route,generate_ground,choose_style_reference,ground_prompt,route_batches,attached_prompt


class RouteTests(unittest.TestCase):
    def test_repair_keeps_command_and_requires_audit(self):
        infer=Mock(side_effect=[({'placement':'ground','item':'Add one pumpkin.'},'bad'),
                                ({'placement':'wall','item':None},'repair'),({'supported':True},'audit')])
        result=plan_route(infer,['Add light.'],{},repair_attempts=1)
        self.assertEqual(result['placement'],'wall')
        self.assertEqual(result['commands'],['Add light.'])
        self.assertEqual(infer.call_count,3)
        self.assertIn('Previous attempt failed',infer.call_args_list[1].args[0])
        self.assertNotIn('Previous attempt failed',infer.call_args_list[2].args[0])
        self.assertIn('Empty items for an attached route is correct',infer.call_args_list[2].args[0])

    def test_failed_repair_is_bounded_and_recorded(self):
        infer=Mock(return_value=({'placement':'ground','item':'Add one pumpkin.'},'bad'))
        with self.assertRaises(ValueError) as error:
            plan_route(infer,['Add light.'],{},repair_attempts=1)
        self.assertEqual(infer.call_count,2)
        self.assertEqual(len(error.exception.report['responses']),2)

    def test_light_cannot_be_replaced_by_pumpkin(self):
        infer=Mock(return_value=({'placement':'ground','item':'Add one carved pumpkin.'},'raw'))
        with self.assertRaisesRegex(ValueError,'changed requested identity'):
            plan_route(infer,['Add light.'],{})
        self.assertEqual(infer.call_count,1)

    def test_mixed_commands_keep_separate_audited_routes(self):
        infer=Mock(side_effect=[({'placement':'wall','items':[]},'wall'),({'supported':True},'audit'),
            ({'placement':'ground','items':['Add one carved pumpkin.']},'ground'),({'supported':True},'audit')])
        result=plan_route(infer,['Add hanging lights to the wall.','Add pumpkins beside the house.'],{'kind':'building'})
        self.assertEqual(result['placement'],'mixed')
        batches=route_batches(result)
        self.assertEqual(batches[0]['commands'],['Add hanging lights to the wall.'])
        self.assertEqual(batches[1]['items'],['Add one carved pumpkin.'])
        self.assertNotIn('pumpkins',infer.call_args_list[0].args[0])
        prompt=attached_prompt(result,'legacy')
        self.assertIn('On the wall',prompt)
        self.assertNotIn('pumpkins',prompt)
        self.assertEqual(attached_prompt({'placement':'wall','items':[]},'legacy'),'legacy')

    def test_shape_material_contract_is_shared_and_audited(self):
        command='Add one wooden crate with a square silhouette and contrasting plank seams.'
        infer=Mock(side_effect=[({'placement':'ground','items':[command]},'route'),
                                ({'supported':True},'audit')])
        result=plan_route(infer,['Add a crate outside.'],{'kind':'building'})
        self.assertEqual(result['items'],[command])
        self.assertIn('defining silhouette',infer.call_args_list[0].args[0])
        self.assertIn('Reject changed identity',infer.call_args_list[1].args[0])
        self.assertIn(command,ground_prompt(command))
        self.assertIn('material texture legible',ground_prompt(command))

    def test_small_reference_selected_without_asset_name_rules(self):
        name,_=choose_style_reference([('large',Image.new('RGBA',(512,480),'white')),
            ('empty',Image.new('RGBA',(32,32))),('small',Image.new('RGBA',(32,32),'red'))])
        self.assertEqual(name,'small')

    def test_plural_route_rejected(self):
        with self.assertRaisesRegex(ValueError,'single-object'):
            plan_route(lambda _:({'placement':'ground','items':['Add boxes.']},''),['Add boxes.'],{})

    def test_ground_route_preserves_dsl(self):
        infer=Mock(side_effect=[({'placement':'ground','items':['Add one small pumpkin.']},'route'),
                                ({'supported':True},'audit')])
        result=plan_route(infer,['Add pumpkins outside.'],{'kind':'building'})
        self.assertEqual(result['items'],['Add one small pumpkin.'])

    def test_unsupported_route_is_rejected(self):
        infer=Mock(side_effect=[({'placement':'wall','items':[]},'route'),({'supported':False},'audit')])
        with self.assertRaisesRegex(ValueError,'audit failed'):plan_route(infer,['Add a freestanding prop.'],{})

    def test_ground_route_requires_items(self):
        with self.assertRaises(ValueError):plan_route(lambda _:({'placement':'ground','items':[]},''),[],{})

    def test_extra_item_type_rejected_before_model_audit(self):
        infer=Mock(return_value=({'placement':'ground','items':['Add one box.','Add one ribbon.']},''))
        with self.assertRaisesRegex(ValueError,'additional item'):plan_route(infer,['Add a box.'],{})
        self.assertEqual(infer.call_count,1)

    def test_reuse_keeps_original_unchanged(self):
        with tempfile.TemporaryDirectory() as temp:
            reference=Image.new('RGBA',(64,64),'red');before=reference.tobytes()
            request=Mock(return_value=Image.new('RGB',(512,512),'gray'))
            with patch('decoration_routes.extract_sprite',return_value=(Image.new('RGBA',(32,32),'orange'),{})):
                first,key=generate_ground(Path(temp),'Add one pumpkin.',reference,'unused',request)
                second,key2=generate_ground(Path(temp),'Add one pumpkin.',reference,'unused',request)
            self.assertEqual(request.call_count,1)
            self.assertEqual(key,key2)
            self.assertEqual(first.tobytes(),second.tobytes())
            self.assertEqual(reference.tobytes(),before)


if __name__=='__main__':unittest.main()
