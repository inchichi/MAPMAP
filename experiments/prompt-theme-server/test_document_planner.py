import base64
import io
import unittest
import zipfile
from document_planner import extract_document, object_plan, normalize_document, audit_requirement_operations


class DocumentPlannerTests(unittest.TestCase):
    def test_geometry_and_gameplay_are_not_decoration(self):
        document={'blocks':[{'id':'p1','text':'New house and timed event'}]}
        requirements=[{'evidence':['p1'],'text':text,'targets':['building'],'operation':'decoration'} for text in ['New roof','Timed quest']]
        result=audit_requirement_operations(lambda *a,**k:({'decisions':[
            {'index':0,'category':'geometry','supported':True,'reason':'New silhouette'},
            {'index':1,'category':'gameplay','supported':True,'reason':'Timed quest'}]},'raw'),document,requirements,lambda *a:None)
        self.assertEqual([r['operation'] for r in result],['deferred','deferred'])
        self.assertEqual(result[0]['evidence'],['p1'])

    def test_requirement_audit_cannot_omit_or_duplicate_entries(self):
        document={'blocks':[{'id':'p1','text':'Leaves'}]}
        requirements=[{'evidence':['p1'],'text':'Autumn leaves','targets':['tree'],'operation':'color'}]
        with self.assertRaisesRegex(ValueError,'every entry'):
            audit_requirement_operations(lambda *a,**k:({'decisions':[]},''),document,requirements,lambda *a:None)

    def test_ambiguous_multiple_categories_are_deferred(self):
        document={'blocks':[{'id':'p1','text':'Leaves'}]}
        rows=[{'evidence':['p1'],'text':'Autumn leaves','targets':['tree'],'operation':'decoration'}]
        result=audit_requirement_operations(lambda *a,**k:({'decisions':[{'index':0,'category':'color|decoration','supported':True}]},''),document,rows,lambda *a:None)
        self.assertEqual(result[0]['operation'],'deferred')

    def test_ground_props_are_not_wall_ornaments(self):
        result,_=object_plan(lambda p: ({'supported':True,'reason':'Explicit props'} if p.startswith('Audit') else {'evidence':['p1'],'commands':['Add small haystacks.'],'placement':'ground','color':None},''),{'blocks':[{'id':'p1','text':'Haystacks outside houses'}]}, {'kind':'building'}, {})
        self.assertIn('ground level',result['prompt'])
        self.assertIn('Do not place props on walls',result['prompt'])
        self.assertIn('Do not remove or replace',result['prompt'])

    def test_normalization_rejects_unknown_sources(self):
        with self.assertRaises(ValueError):
            normalize_document(lambda *a,**k: ({'requirements':[{'evidence':['p2'],'text':'Autumn leaves','targets':['tree'],'operation':'color'}]},'raw'),{'blocks':[{'id':'p1','text':'Leaves'}]},lambda *a:None)

    def test_color_operation_cannot_become_decoration(self):
        document={'blocks':[{'id':'p1','text':'Autumn leaves'}],'requirements':[{'evidence':['p1'],'text':'Autumn leaves','targets':['tree'],'operation':'color'}]}
        result,_=object_plan(lambda _: ({'evidence':['p1'],'commands':['Add autumn foliage.'],'color':None},''),document,{'kind':'tree'}, {})
        self.assertEqual(result['commands'],[])
        self.assertEqual(result['discarded_commands'],['Add autumn foliage.'])

    def test_extract_paragraphs_and_tables(self):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as archive:
            archive.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Night</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Autumn trees</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
        result=extract_document(base64.b64encode(stream.getvalue()))
        self.assertEqual(result['blocks'],[{'id':'p1','text':'Night'},{'id':'p2','text':'Autumn trees'}])

    def test_invalid_evidence_rejected(self):
        with self.assertRaises(ValueError):
            object_plan(lambda _: ({'evidence':['p99'],'commands':['Add pumpkins.']},''),{'blocks':[{'id':'p1','text':'Pumpkins'}]}, {}, {})

    def test_dsl_is_prompt(self):
        result,_=object_plan(lambda p: ({'supported':True,'reason':'Explicit pumpkins'} if p.startswith('Audit') else {'evidence':['p1'],'commands':['Add small pumpkins.'],'color':None},''),{'blocks':[{'id':'p1','text':'Pumpkins'}]}, {}, {})
        self.assertIn('Add small pumpkins.',result['prompt'])
        self.assertIn('Keep the original shape',result['prompt'])

    def test_unsupported_commands_flagged(self):
        result,_=object_plan(lambda p: ({'supported':False,'reason':'No webs in source'} if p.startswith('Audit') else {'evidence':['p1'],'commands':['Add cobwebs.'],'color':None},''),{'blocks':[{'id':'p1','text':'Straw'}]}, {}, {})
        self.assertFalse(result['evidence_audit']['supported'])

    def test_color_without_evidence_rejected(self):
        with self.assertRaises(ValueError):
            object_plan(lambda _: ({'evidence':[],'commands':[],'color':{'brightness':.7}},''),{'blocks':[]}, {}, {})


if __name__=='__main__': unittest.main()
