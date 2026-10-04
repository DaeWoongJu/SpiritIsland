// 정령섬.exe / 아르낙.exe — Windows용 실행 아이콘 (같은 소스, 설정만 다름: config-*.h).
// 서버가 이미 켜져 있으면 브라우저만 열고, 아니면 start-*.bat 을 실행한다.
// 빌드: launcher/build.sh (mingw-w64)
#define WIN32_LEAN_AND_MEAN
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <winsock2.h>
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <objbase.h>
#include <knownfolders.h>
#include <wchar.h>

// 기본값: 정령섬. 아르낙은 config-arnak.h 를 -include 로 넣어 덮어쓴다.
#ifndef APP_SHORT
#define APP_SHORT L"정령섬"
#define APP_TITLE L"정령섬 온라인"
#define APP_EXE L"정령섬.exe"
#define APP_PORT 3000
#define APP_URL L"http://localhost:3000"
#define APP_BAT L"start-windows.bat"
#define APP_PROTO L"spiritisland"
#define APP_MARKER L".shortcut-created"
#endif

// 바탕화면/시작 메뉴에 이 exe 를 가리키는 "정령섬" 바로가기를 만든다.
static int make_shortcut(REFKNOWNFOLDERID folder, const wchar_t *exe, const wchar_t *dir) {
  PWSTR base = NULL;
  if (FAILED(SHGetKnownFolderPath(folder, 0, NULL, &base))) return 0;
  wchar_t path[MAX_PATH];
  swprintf(path, MAX_PATH, L"%ls\\" APP_SHORT L".lnk", base);
  CoTaskMemFree(base);
  IShellLinkW *link = NULL;
  if (FAILED(CoCreateInstance(&CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, &IID_IShellLinkW, (void **)&link))) return 0;
  link->lpVtbl->SetPath(link, exe);
  link->lpVtbl->SetWorkingDirectory(link, dir);
  link->lpVtbl->SetIconLocation(link, exe, 0);
  link->lpVtbl->SetDescription(link, APP_TITLE L" 서버를 켜고 게임을 엽니다");
  IPersistFile *pf = NULL;
  int ok = 0;
  if (SUCCEEDED(link->lpVtbl->QueryInterface(link, &IID_IPersistFile, (void **)&pf))) {
    ok = SUCCEEDED(pf->lpVtbl->Save(pf, path, TRUE));
    pf->lpVtbl->Release(pf);
  }
  link->lpVtbl->Release(link);
  return ok;
}

// 처음 실행할 때 한 번만 바로가기를 만든다 (지운 뒤 다시 생기지 않도록 표시 파일을 남김).
// 인자로 --shortcut 을 주면 표시 파일과 상관없이 다시 만든다.
static void ensure_shortcuts(const wchar_t *dir, int force) {
  wchar_t marker[MAX_PATH], exe[MAX_PATH];
  swprintf(marker, MAX_PATH, L"%ls\\" APP_MARKER, dir);
  if (!force && GetFileAttributesW(marker) != INVALID_FILE_ATTRIBUTES) return;
  GetModuleFileNameW(NULL, exe, MAX_PATH);
  CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
  int ok = make_shortcut(&FOLDERID_Desktop, exe, dir);
  make_shortcut(&FOLDERID_Programs, exe, dir);
  CoUninitialize();
  if (ok) {
    HANDLE h = CreateFileW(marker, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_HIDDEN, NULL);
    if (h != INVALID_HANDLE_VALUE) CloseHandle(h);
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL);
    if (force) MessageBoxW(NULL, L"바탕화면과 시작 메뉴에 '" APP_SHORT L"' 아이콘을 만들었습니다.", APP_TITLE, MB_OK | MB_ICONINFORMATION);
  } else if (force) {
    MessageBoxW(NULL, L"바로가기를 만들지 못했습니다.\n" APP_EXE L" 를 우클릭 → '바로 가기 만들기'로 직접 만들어 주세요.", APP_TITLE, MB_OK | MB_ICONWARNING);
  }
}

static int server_running(void) {
  WSADATA wsa;
  if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) return 0;
  SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  int ok = 0;
  if (s != INVALID_SOCKET) {
    struct sockaddr_in addr;
    ZeroMemory(&addr, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(APP_PORT);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    ok = connect(s, (struct sockaddr *)&addr, sizeof(addr)) == 0;
    closesocket(s);
  }
  WSACleanup();
  return ok;
}

// spiritisland:// 주소를 이 exe 와 연결한다 (브라우저의 "서버 켜기" 버튼용, 관리자 권한 불필요).
static void set_reg(const wchar_t *key, const wchar_t *name, const wchar_t *value) {
  HKEY h;
  if (RegCreateKeyExW(HKEY_CURRENT_USER, key, 0, NULL, 0, KEY_WRITE, NULL, &h, NULL) != ERROR_SUCCESS) return;
  RegSetValueExW(h, name, 0, REG_SZ, (const BYTE *)value, (DWORD)((wcslen(value) + 1) * sizeof(wchar_t)));
  RegCloseKey(h);
}
static void register_protocol(void) {
  wchar_t exe[MAX_PATH], buf[MAX_PATH * 2];
  GetModuleFileNameW(NULL, exe, MAX_PATH);
  set_reg(L"Software\\Classes\\" APP_PROTO, NULL, L"URL:" APP_TITLE);
  set_reg(L"Software\\Classes\\" APP_PROTO, L"URL Protocol", L"");
  swprintf(buf, MAX_PATH * 2, L"\"%ls\",0", exe);
  set_reg(L"Software\\Classes\\" APP_PROTO L"\\DefaultIcon", NULL, buf);
  swprintf(buf, MAX_PATH * 2, L"\"%ls\" \"%%1\"", exe);
  set_reg(L"Software\\Classes\\" APP_PROTO L"\\shell\\open\\command", NULL, buf);
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE hPrev, PWSTR cmd, int show) {
  (void)hInst; (void)hPrev; (void)show;
  wchar_t dir[MAX_PATH];
  DWORD n = GetModuleFileNameW(NULL, dir, MAX_PATH);
  if (n == 0 || n >= MAX_PATH) return 1;
  wchar_t *slash = wcsrchr(dir, L'\\');
  if (slash) *slash = 0;

  int force = cmd && wcsstr(cmd, L"--shortcut") != NULL;
  // 브라우저 안내 화면의 "서버 켜기" 버튼으로 실행된 경우: 브라우저는 이미 열려 있으므로 새로 열지 않는다
  int viaProtocol = cmd && wcsstr(cmd, APP_PROTO L":") != NULL;
  register_protocol();
  ensure_shortcuts(dir, force);
  if (force) return 0;

  if (server_running()) {
    if (!viaProtocol) ShellExecuteW(NULL, L"open", APP_URL, NULL, NULL, SW_SHOWNORMAL);
    return 0;
  }

  wchar_t found[MAX_PATH];
  if (!SearchPathW(NULL, L"node.exe", NULL, MAX_PATH, found, NULL)) {
    int r = MessageBoxW(NULL,
      APP_SHORT L"을(를) 실행하려면 Node.js가 필요합니다.\n\n[확인]을 누르면 설치 페이지가 열립니다.\nLTS 버전을 설치한 뒤 다시 실행해 주세요.",
      APP_TITLE, MB_OKCANCEL | MB_ICONINFORMATION);
    if (r == IDOK) ShellExecuteW(NULL, L"open", L"https://nodejs.org/ko/download", NULL, NULL, SW_SHOWNORMAL);
    return 1;
  }

  // 자동 업데이트: 서버를 켜기 전에 GitHub 에서 새 버전을 확인한다 (실패해도 계속 진행)
  wchar_t ps1[MAX_PATH], params[MAX_PATH * 2];
  swprintf(ps1, MAX_PATH, L"%ls\\scripts\\update.ps1", dir);
  if (GetFileAttributesW(ps1) != INVALID_FILE_ATTRIBUTES) {
    swprintf(params, MAX_PATH * 2, L"-NoProfile -ExecutionPolicy Bypass -File \"%ls\"", ps1);
    SHELLEXECUTEINFOW sei;
    ZeroMemory(&sei, sizeof(sei));
    sei.cbSize = sizeof(sei);
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    sei.lpVerb = L"open";
    sei.lpFile = L"powershell.exe";
    sei.lpParameters = params;
    sei.lpDirectory = dir;
    sei.nShow = SW_SHOWNORMAL;
    if (ShellExecuteExW(&sei) && sei.hProcess) {
      WaitForSingleObject(sei.hProcess, 5 * 60 * 1000);
      CloseHandle(sei.hProcess);
    }
  }

  wchar_t bat[MAX_PATH];
  if (swprintf(bat, MAX_PATH, L"%ls\\" APP_BAT, dir) < 0) return 1;
  if (GetFileAttributesW(bat) == INVALID_FILE_ATTRIBUTES) {
    MessageBoxW(NULL, APP_BAT L" 파일을 찾을 수 없습니다.\n" APP_EXE L" 는 게임 폴더 안에 그대로 두고 실행해 주세요.\n(바탕화면에 두려면 '바로 가기 만들기'를 사용하세요.)",
      APP_TITLE, MB_OK | MB_ICONWARNING);
    return 1;
  }
  HINSTANCE h = ShellExecuteW(NULL, L"open", bat, viaProtocol ? L"noopen" : NULL, dir, SW_SHOWNORMAL);
  if ((INT_PTR)h <= 32) {
    MessageBoxW(NULL, L"서버를 시작하지 못했습니다. " APP_BAT L" 을 직접 실행해 보세요.", APP_TITLE, MB_OK | MB_ICONERROR);
    return 1;
  }
  return 0;
}
