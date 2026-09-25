"""Run current production composition on saved FLUX outputs as a new experiment."""
import re,shutil,sys
from crypt_plan_style import ROOT,prepare_data,read,run,write
from run_records import record_event


def reprocess(source_id):
    if not re.fullmatch('[a-f0-9]{32}',source_id):raise ValueError('Invalid run ID')
    if (ROOT/'.batch.lock').exists():raise ValueError('Generation is busy')
    source=ROOT/source_id
    if read(source,'status.json')['status']!='ready':raise ValueError('Source not ready')
    rows=read(source,'plan.json')
    for row in rows:
        if row['action']=='decorate':
            for file in ['flux-raw.png','generation.json','request-timing.json']:
                if not (source/row['asset']/file).is_file():raise ValueError('Missing saved FLUX output')
    run_id=prepare_data(read(source,'dsl.json'),rows)
    folder=ROOT/run_id
    for row in rows:
        if row['action']=='decorate':shutil.copytree(source/row['asset'],folder/row['asset'])
    record_event(folder,'saved_model_output_reused',source_run_id=source_id,model_called=False)
    run(run_id)
    status=read(folder,'status.json')
    status['source_run_id']=source_id
    for result in status['object_results'].values():result['reused_from']=source_id
    from theme_pipeline import save_status
    save_status(folder,status)
    print(run_id)


if __name__=='__main__':reprocess(sys.argv[1])
