// 정령섬.exe — Windows용 실행 아이콘.
// 서버가 이미 켜져 있으면 브라우저만 열고, 아니면 start-windows.bat 을 실행한다.
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

// 바탕화면/시작 메뉴에 이 exe 를 가리키는 "정령섬" 바로가기를 만든다.
static int make_shortcut(REFKNOWNFOLDERID folder, const wchar_t *exe, const wchar_t *dir) {
  PWSTR base = NULL;
  if (FAILED(SHGetKnownFolderPath(folder, 0, NULL, &base))) return 0;
  wchar_t path[MAX_PATH];
  swprintf(path, MAX_PATH, L"%ls\\정령섬.lnk", base);
  CoTaskMemFree(base);
  IShellLinkW *link = NULL;
  if (FAILED(CoCreateInstance(&CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, &IID_IShellLinkW, (void **)&link))) return 0;
  link->lpVtbl->SetPath(link, exe);
  link->lpVtbl->SetWorkingDirectory(link, dir);
  link->lpVtbl->SetIconLocation(link, exe, 0);
  link->lpVtbl->SetDescription(link, L"정령섬 온라인 서버를 켜고 게임을 엽니다");
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
  swprintf(marker, MAX_PATH, L"%ls\\.shortcut-created", dir);
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
    if (force) MessageBoxW(NULL, L"바탕화면과 시작 메뉴에 '정령섬' 아이콘을 만들었습니다.", L"정령섬 온라인", MB_OK | MB_ICONINFORMATION);
  } else if (force) {
    MessageBoxW(NULL, L"바로가기를 만들지 못했습니다.\n정령섬.exe 를 우클릭 → '바로 가기 만들기'로 직접 만들어 주세요.", L"정령섬 온라인", MB_OK | MB_ICONWARNING);
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
    addr.sin_port = htons(3000);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    ok = connect(s, (struct sockaddr *)&addr, sizeof(addr)) == 0;
    closesocket(s);
  }
  WSACleanup();
  return ok;
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE hPrev, PWSTR cmd, int show) {
  (void)hInst; (void)hPrev; (void)show;
  wchar_t dir[MAX_PATH];
  DWORD n = GetModuleFileNameW(NULL, dir, MAX_PATH);
  if (n == 0 || n >= MAX_PATH) return 1;
  wchar_t *slash = wcsrchr(dir, L'\\');
  if (slash) *slash = 0;

  int force = cmd && wcsstr(cmd, L"--shortcut") != NULL;
  ensure_shortcuts(dir, force);
  if (force) return 0;

  if (server_running()) {
    ShellExecuteW(NULL, L"open", L"http://localhost:3000", NULL, NULL, SW_SHOWNORMAL);
    return 0;
  }

  wchar_t found[MAX_PATH];
  if (!SearchPathW(NULL, L"node.exe", NULL, MAX_PATH, found, NULL)) {
    int r = MessageBoxW(NULL,
      L"정령섬을 실행하려면 Node.js가 필요합니다.\n\n[확인]을 누르면 설치 페이지가 열립니다.\nLTS 버전을 설치한 뒤 다시 실행해 주세요.",
      L"정령섬 온라인", MB_OKCANCEL | MB_ICONINFORMATION);
    if (r == IDOK) ShellExecuteW(NULL, L"open", L"https://nodejs.org/ko/download", NULL, NULL, SW_SHOWNORMAL);
    return 1;
  }

  wchar_t bat[MAX_PATH];
  if (swprintf(bat, MAX_PATH, L"%ls\\start-windows.bat", dir) < 0) return 1;
  if (GetFileAttributesW(bat) == INVALID_FILE_ATTRIBUTES) {
    MessageBoxW(NULL, L"start-windows.bat 파일을 찾을 수 없습니다.\n정령섬.exe 는 게임 폴더 안에 그대로 두고 실행해 주세요.\n(바탕화면에 두려면 '바로 가기 만들기'를 사용하세요.)",
      L"정령섬 온라인", MB_OK | MB_ICONWARNING);
    return 1;
  }
  HINSTANCE h = ShellExecuteW(NULL, L"open", bat, NULL, dir, SW_SHOWNORMAL);
  if ((INT_PTR)h <= 32) {
    MessageBoxW(NULL, L"서버를 시작하지 못했습니다. start-windows.bat 을 직접 실행해 보세요.", L"정령섬 온라인", MB_OK | MB_ICONERROR);
    return 1;
  }
  return 0;
}
