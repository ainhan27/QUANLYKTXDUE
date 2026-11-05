// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// ELECTRON DESKTOP RUNNER (DESKTOP APP BẢO ĐẢM HOẠT ĐỘNG ĐỘC LẬP & OFFLINE RESILIENT)
// ==============================================================================

const { app, BrowserWindow, Menu, dialog } = require('electron');
const http = require('http');
const path = require('path');
const { spawn, execSync } = require('child_process');

let mainWindow = null;
let serverProcess = null;
let serverSpawnedByUs = false;

const TARGET_PORT = 3000;
const SERVER_URL = `http://localhost:${TARGET_PORT}`;

// Kiểm tra xem máy chủ Next.js đã chạy trên port 3000 hay chưa
function pingServer(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Chờ máy chủ sẵn sàng với giới hạn thời gian (timeout 45s)
async function waitForServer(url, timeoutMs = 45000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isUp = await pingServer(url);
    if (isUp) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

// Khởi chạy tiến trình Next.js ngầm nếu chưa có
function startNextServerIfNeeded() {
  const rootDir = path.resolve(__dirname, '..');
  const isProd = process.env.NODE_ENV === 'production';
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const scriptName = isProd ? 'start' : 'dev';

  console.log(`[Desktop App] Khởi động tiến trình máy chủ nội bộ: npm ${scriptName}...`);
  
  // Thiết lập biến môi trường kèm Node.js PATH nếu có
  const env = { ...process.env, PORT: String(TARGET_PORT) };
  if (process.platform === 'win32' && !env.PATH.includes('nodejs')) {
    env.PATH = `C:\\Program Files\\nodejs;${env.PATH}`;
  }

  serverProcess = spawn(cmd, ['run', scriptName], {
    cwd: rootDir,
    shell: true,
    env,
    stdio: 'ignore', // Không làm nghẽn pipe hoặc mở terminal phụ
    detached: false,
  });

  serverSpawnedByUs = true;

  serverProcess.on('error', (err) => {
    console.error('[Desktop App] Lỗi khởi động máy chủ:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`[Desktop App] Máy chủ đã dừng với mã ${code}, tín hiệu ${signal}`);
  });
}

// Dọn dẹp tiến trình khi thoát ứng dụng
function cleanupServer() {
  if (serverSpawnedByUs && serverProcess && serverProcess.pid) {
    try {
      console.log(`[Desktop App] Đang đóng tiến trình máy chủ con PID: ${serverProcess.pid}...`);
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {
      // Bỏ qua nếu tiến trình đã tự kết thúc
    }
    serverProcess = null;
    serverSpawnedByUs = false;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: 'KTX ĐH Kinh Tế Đà Nẵng – Hệ Thống Tuyển Sinh Nội Trú To-Be (MIS3047)',
    backgroundColor: '#003366',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false, // Hiện sau khi đã tải xong splash
  });

  // Tải Splash Screen ngay lập tức để người dùng có phản hồi trực quan
  const splashPath = path.join(__dirname, 'splash.html');
  await mainWindow.loadFile(splashPath);
  mainWindow.show();

  // Thiết lập Menu điều hướng chuẩn doanh nghiệp
  const menuTemplate = [
    {
      label: 'Điều Hướng Phân Hệ',
      submenu: [
        { label: 'Trang Chủ Cổng Tuyển Sinh', click: () => mainWindow.loadURL(SERVER_URL) },
        { label: 'Cổng Sinh Viên Nộp & Ký Hợp Đồng', click: () => mainWindow.loadURL(`${SERVER_URL}/student`) },
        { label: 'Bảng Xếp Hạng Tuyển Sinh (350 SV)', click: () => mainWindow.loadURL(`${SERVER_URL}/ranking`) },
        { label: 'Cán Bộ QLSV Rà Soát Minh Chứng', click: () => mainWindow.loadURL(`${SERVER_URL}/officer`) },
        { label: 'Dashboard Trưởng Ban & Phê Duyệt', click: () => mainWindow.loadURL(`${SERVER_URL}/director`) },
        { type: 'separator' },
        { label: 'Làm mới màn hình (F5)', role: 'reload' },
        { label: 'Đóng ứng dụng (Alt+F4)', role: 'quit' },
      ],
    },
    {
      label: 'Giao Diện',
      submenu: [
        { label: 'Phóng to (+)', role: 'zoomIn' },
        { label: 'Thu nhỏ (-)', role: 'zoomOut' },
        { label: 'Tỉ lệ mặc định (100%)', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Chế độ Toàn Màn Hình (F11)', role: 'togglefullscreen' },
        { label: 'Công cụ gỡ lỗi (DevTools)', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Hỗ Trợ',
      submenu: [
        {
          label: 'Giới Thiệu Đề Tài MIS3047 (Nhóm 4)',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Hệ Thống Quản Lý Ký Túc Xá DUE (To-Be)',
              message:
                'ĐỀ TÀI: QUẢN LÝ QUY TRÌNH KINH DOANH (MIS3047)\n' +
                'Trường Đại học Kinh tế – Đại học Đà Nẵng (DUE)\n\n' +
                'Kiến trúc BPMN 2.0 To-Be 10 Bước:\n' +
                '• Sàng lọc hộ khẩu & Thẩm định AI Vision (Gemini 1.5)\n' +
                '• Bảng xếp hạng Real-time quy mô 350 sinh viên\n' +
                '• Chốt danh sách Top 120 & Phát hành hợp đồng điện tử\n' +
                '• Phân phòng & Thu hồi quá hạn 72h tự động\n\n' +
                'Chế độ hoạt động: Desktop App Độc Lập / Dual-Mode Web',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Xử lý kiểm tra và kết nối server
  const alreadyRunning = await pingServer(SERVER_URL);
  if (!alreadyRunning) {
    startNextServerIfNeeded();
  }

  const isServerReady = await waitForServer(SERVER_URL, 45000);

  if (isServerReady) {
    mainWindow.loadURL(SERVER_URL);
  } else {
    dialog.showErrorBox(
      'Không thể kết nối máy chủ',
      'Không thể khởi động máy chủ Next.js cục bộ trên cổng 3000. Vui lòng kiểm tra lại môi trường Node.js.'
    );
  }

  // Cơ chế phục hồi khi mất kết nối mạng / tải trang thất bại
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.includes('localhost:3000')) {
      console.warn(`[Desktop App] Tải trang thất bại (${errorCode}: ${errorDescription}), thử kết nối lại...`);
      setTimeout(async () => {
        const ready = await pingServer(SERVER_URL);
        if (ready && mainWindow) {
          mainWindow.loadURL(validatedURL);
        }
      }, 2000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Khởi chạy App Electron
app.whenReady().then(createWindow);

// Khi toàn bộ cửa sổ đã đóng
app.on('window-all-closed', () => {
  cleanupServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Khi ứng dụng chuẩn bị thoát
app.on('before-quit', () => {
  cleanupServer();
});

app.on('will-quit', () => {
  cleanupServer();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
