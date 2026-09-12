from pathlib import Path

source = Path('app/src/main/assets/customization.js')
patch = Path('tools/ui_fixes.js').read_text(encoding='utf-8')
text = source.read_text(encoding='utf-8')
marker = '/* ScheduleApp UI fixes / motion layer */'
if marker not in text:
    source.write_text(text.rstrip() + '\n\n' + patch, encoding='utf-8')
    print('UI fixes appended to customization.js')
else:
    print('UI fixes already present')
