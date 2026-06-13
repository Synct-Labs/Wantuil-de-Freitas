const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const log = require('electron-log');

log.transports.file.level = 'info';
log.info('Iniciando Almoxarifado Wantuil...');

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 3737;

// ── Caminho dos dados (persistente entre atualizações) ──
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'almoxarifado.db');

log.info(`Banco de dados: ${dbPath}`);

// ── Iniciar o backend embutido ──
function iniciarBackend() {
  const isDev = !app.isPackaged;
  const backendPath = isDev
    ? path.join(__dirname, '..', 'resources', 'backend')
    : path.join(process.resourcesPath, 'backend');

  log.info(`Backend em: ${backendPath}`);

  // Criar banco se não existir (Prisma + SQLite cria automaticamente na primeira execução)
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.PORT = BACKEND_PORT;
  process.env.JWT_SECRET = 'chave-local-troque-em-producao-' + app.getVersion();
  process.env.NODE_ENV = 'production';

  const nodeBin = process.execPath;
  const entryPoint = path.join(backendPath, 'dist', 'main.js');

  backendProcess = spawn(nodeBin, [entryPoint], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    cwd: backendPath,
  });

  backendProcess.stdout.on('data', (data) => log.info(`[backend] ${data}`));
  backendProcess.stderr.on('data', (data) => log.error(`[backend] ${data}`));

  backendProcess.on('error', (err) => {
    log.error('Erro ao iniciar backend:', err);
    dialog.showErrorBox('Erro', `Não foi possível iniciar o sistema:\n${err.message}`);
  });
}

// ── Aguardar backend ficar pronto e abrir janela ──
async function aguardarBackend(maxTentativas = 30) {
  for (let i = 0; i < maxTentativas; i++) {
    try {
      const resp = await fetch(`http://localhost:${BACKEND_PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '_', senha: '_' }),
      });
      // qualquer resposta (mesmo 400/401) significa que está online
      if (resp.status) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

// ── Criar janela principal ──
function criarJanela() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Almoxarifado Wantuil',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const frontendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'frontend', 'index.html')
    : path.join(__dirname, '..', 'resources', 'frontend-dist', 'index.html');

  mainWindow.loadFile(frontendPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir links externos no navegador, não dentro do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Configurar o frontend para falar com o backend local
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.__API_URL__ = 'http://localhost:${BACKEND_PORT}/api';
    `);
  });
}

// ── Menu em português ──
function criarMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Backup do banco',
          click: async () => {
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
              title: 'Salvar backup',
              defaultPath: `backup-almoxarifado-${new Date().toISOString().split('T')[0]}.db`,
              filters: [{ name: 'Banco SQLite', extensions: ['db'] }],
            });
            if (filePath) {
              fs.copyFileSync(dbPath, filePath);
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Backup concluído',
                message: 'Backup salvo com sucesso!',
                detail: filePath,
              });
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamanho normal' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre',
              message: 'Almoxarifado Wantuil',
              detail: `Versão ${app.getVersion()}\n\nSistema de Gestão de Almoxarifado\nInstituição de Caridade Wantuil de Freitas\nCuiabá - MT`,
            });
          },
        },
        {
          label: 'Abrir pasta de dados',
          click: () => shell.openPath(userDataPath),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Ciclo de vida da aplicação ──
app.whenReady().then(async () => {
  iniciarBackend();

  // Janela de carregamento simples
  const loadingWin = new BrowserWindow({
    width: 360,
    height: 200,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  loadingWin.loadURL(`data:text/html;charset=utf-8,
    <html><body style="margin:0;font-family:system-ui;background:#1a3a06;color:#fff;
    display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;border-radius:12px">
    <div style="font-size:40px">🏪</div>
    <div style="font-weight:600;margin-top:8px">Almoxarifado Wantuil</div>
    <div style="font-size:12px;opacity:0.7;margin-top:8px">Iniciando o sistema...</div>
    </body></html>`);

  const ok = await aguardarBackend();
  loadingWin.close();

  if (!ok) {
    dialog.showErrorBox('Erro', 'O sistema não conseguiu iniciar. Verifique o log em:\n' +
      log.transports.file.getFile().path);
    app.quit();
    return;
  }

  criarMenu();
  criarJanela();
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
