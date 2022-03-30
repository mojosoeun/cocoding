import './style.css';

import * as CodeMirror from 'codemirror';
import yorkie from 'yorkie-js-sdk';

const textarea = document.querySelector<HTMLTextAreaElement>('#codemirror')!;
const iframe = document.querySelector<HTMLIFrameElement>('#iframe')!;

function addChange(editor: any, from: any, to: any, text: any) {
  const adjust = editor.listSelections().findIndex(({ anchor, head }) => {
    return (
      CodeMirror.cmpPos(anchor, head) == 0 &&
      CodeMirror.cmpPos(anchor, from) == 0
    );
  });
  editor.operation(() => {
    editor.replaceRange(text, from, to, 'yorkie');
    if (adjust > -1) {
      const range = editor.listSelections()[adjust];
      if (
        range &&
        CodeMirror.cmpPos(
          range.head,
          CodeMirror.changeEnd({ from, to, text }),
        ) == 0
      ) {
        const ranges = editor.listSelections().slice();
        ranges[adjust] = { anchor: from, head: from };
        editor.setSelections(ranges);
      }
    }
  });
}

async function main() {
  const editor = CodeMirror.fromTextArea(textarea, {
    lineNumbers: true,
    mode: 'javascript',
    theme: 'the-matrix',
  });

  const client = yorkie.createClient('http://localhost:8080');
  await client.activate();

  const doc = yorkie.createDocument('docs', 'doc1');
  await client.attach(doc);

  doc.update((root) => {
    if (!root.content) {
      root.createText('content');
    }
  });

  editor.on('beforeChange', (cm, change) => {
    if (change.origin === 'yorkie' || change.origin === 'setValue') {
      return;
    }

    const from = editor.indexFromPos(change.from);
    const to = editor.indexFromPos(change.to);
    const content = change.text.join('\n');
    doc.update((root) => {
      root.content.edit(from, to, content);
    });
  });

  doc.getRoot().content.onChanges((changes: any) => {
    for (const change of changes) {
      if (change.type !== 'content' || change.actor === client.getID()) {
        continue;
      }

      const from = editor.posFromIndex(change.from);
      const to = editor.posFromIndex(change.to);
      addChange(editor, from, to, change.content || '');
    }
  });

  editor.setValue(doc.getRoot().content.getValue());

  editor.on('change', (cm, change) => {
    iframe.srcdoc = `<!DOCTYPE html>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.1/p5.min.js" integrity="sha512-NxocnqsXP3zm0Xb42zqVMvjQIktKEpTIbCXXyhBPxqGZHqhcOXHs4pXI/GoZ8lE+2NJONRifuBpi9DxC58L0Lw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <body>
    <script type="text/javascript">
      ${editor.getValue()}
    </script>
  </body>`;
  });
}

main();
