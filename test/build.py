"""Assemble test.html from ../src the way Apps Script does (include('Engine'), include('App')), with mock.js standing in for google.script.run."""
import os
d=os.path.dirname(os.path.abspath(__file__));src=os.path.join(d,'..','src')
rd=lambda p:open(p,encoding='utf-8').read()
idx=rd(os.path.join(src,'Index.html'))
idx=idx.replace("<?!= include('Engine') ?>","<script>"+rd(os.path.join(d,'mock.js'))+"</script>\n"+rd(os.path.join(src,'Engine.html'))).replace("<?!= include('App') ?>",rd(os.path.join(src,'App.html')))
open(os.path.join(d,'test.html'),'w',encoding='utf-8').write(idx)
