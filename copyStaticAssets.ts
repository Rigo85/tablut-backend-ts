import shell from 'shelljs';

shell.mkdir('-p', 'dist/browser');
shell.cp('-R', 'src/browser/*', 'dist/browser');

shell.mkdir('-p', 'dist/assets/doc');
shell.cp('-R', 'src/assets/doc/*', 'dist/assets/doc');
