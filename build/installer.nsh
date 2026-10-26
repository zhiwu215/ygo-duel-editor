!ifndef BUILD_UNINSTALLER
  !include LogicLib.nsh
  !include nsDialogs.nsh

  !define APP_SUBDIR "ygo-duel-editor"
  !define APP_SUBDIR_LEN 16
  !define DEFAULT_DATA_DIR_NAME "ygo-duel-editor-data"

  Var InstallDirValue
  Var InstallDirField
  Var DataDirValue
  Var DataDirField

  !macro customInit
    StrCpy $InstallDirValue "$INSTDIR"
    StrCpy $DataDirValue ""
    SetShellVarContext current
    ${If} ${FileExists} "$APPDATA\${APP_SUBDIR}\data-dir.txt"
      FileOpen $0 "$APPDATA\${APP_SUBDIR}\data-dir.txt" r
      ${IfNot} ${Errors}
        FileRead $0 $DataDirValue
        FileClose $0
        Call TrimDataDirValue
      ${EndIf}
    ${EndIf}
    ${If} $DataDirValue == ""
    ${AndIf} ${FileExists} "$INSTDIR\data-dir.txt"
      FileOpen $0 "$INSTDIR\data-dir.txt" r
      ${IfNot} ${Errors}
        FileRead $0 $DataDirValue
        FileClose $0
        Call TrimDataDirValue
      ${EndIf}
    ${EndIf}
    ${If} $DataDirValue == ""
      StrCpy $DataDirValue "$LOCALAPPDATA\${DEFAULT_DATA_DIR_NAME}"
    ${EndIf}
    SetShellVarContext all
  !macroend

  Function SetPageHeader
    GetDlgItem $9 $HWNDPARENT 1037
    SendMessage $9 ${WM_SETTEXT} 0 "STR:$1"
    GetDlgItem $9 $HWNDPARENT 1038
    SendMessage $9 ${WM_SETTEXT} 0 "STR:$2"
  FunctionEnd

  Function TrimDataDirValue
    ${Do}
      StrLen $1 $DataDirValue
      ${If} $1 == 0
        ${ExitDo}
      ${EndIf}
      StrCpy $2 $DataDirValue 1 -1
      ${If} $2 == "$\r"
      ${OrIf} $2 == "$\n"
      ${OrIf} $2 == " "
        StrCpy $DataDirValue $DataDirValue -1
      ${Else}
        ${ExitDo}
      ${EndIf}
    ${Loop}
  FunctionEnd

  Function AppendAppSubdir
    ${If} $0 == ""
      Return
    ${EndIf}
    StrCpy $1 $0 "" -1
    ${If} $1 == "\"
      StrCpy $0 $0 -1
    ${EndIf}
    StrLen $2 $0
    ${If} $2 >= ${APP_SUBDIR_LEN}
      StrCpy $1 $0 "" -${APP_SUBDIR_LEN}
      StrCmp $1 "\${APP_SUBDIR}" append_done
    ${EndIf}
    StrCpy $0 "$0\${APP_SUBDIR}"
    append_done:
  FunctionEnd

  Function InstallDirBrowse
    nsDialogs::SelectFolderDialog "选择安装位置" "$InstallDirValue"
    Pop $0
    ${If} $0 != "error"
      Call AppendAppSubdir
      StrCpy $InstallDirValue "$0"
      ${NSD_SetText} $InstallDirField "$InstallDirValue"
    ${EndIf}
  FunctionEnd

  Function InstallDirPageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    StrCpy $1 "安装位置"
    StrCpy $2 "选择软件要安装到的文件夹"
    Call SetPageHeader

    ${NSD_CreateLabel} 0 0 100% 26u "软件会安装到所选目录下的 ${APP_SUBDIR} 子文件夹，避免与其它软件混在一起。"
    Pop $0
    ${NSD_CreateText} 0 32u 76% 13u "$InstallDirValue"
    Pop $InstallDirField
    ${NSD_CreateButton} 78% 32u 22% 13u "浏览..."
    Pop $0
    ${NSD_OnClick} $0 InstallDirBrowse

    nsDialogs::Show
  FunctionEnd

  Function InstallDirPageLeave
    ${NSD_GetText} $InstallDirField $InstallDirValue
    ${If} $InstallDirValue == ""
      StrCpy $InstallDirValue "$PROGRAMFILES64\${APP_SUBDIR}"
    ${EndIf}
    StrCpy $0 "$InstallDirValue"
    Call AppendAppSubdir
    StrCpy $INSTDIR "$0"
  FunctionEnd

  Function DataDirBrowse
    nsDialogs::SelectFolderDialog "选择数据保存目录" "$DataDirValue"
    Pop $0
    ${If} $0 != "error"
      StrCpy $DataDirValue "$0"
      ${NSD_SetText} $DataDirField "$DataDirValue"
    ${EndIf}
  FunctionEnd

  Function DataDirPageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    StrCpy $1 "数据保存目录"
    StrCpy $2 "选择软件数据要保存到的文件夹"
    Call SetPageHeader

    ${NSD_CreateLabel} 0 0 100% 26u "卸载和升级都不会删除此目录。"
    Pop $0
    ${NSD_CreateText} 0 32u 76% 13u "$DataDirValue"
    Pop $DataDirField
    ${NSD_CreateButton} 78% 32u 22% 13u "浏览..."
    Pop $0
    ${NSD_OnClick} $0 DataDirBrowse

    nsDialogs::Show
  FunctionEnd

  Function DataDirPageLeave
    ${NSD_GetText} $DataDirField $DataDirValue
    ${If} $DataDirValue == ""
      SetShellVarContext current
      StrCpy $DataDirValue "$LOCALAPPDATA\${DEFAULT_DATA_DIR_NAME}"
      SetShellVarContext all
    ${EndIf}
    StrCpy $1 $DataDirValue "" -1
    ${If} $1 == "\"
      StrCpy $DataDirValue $DataDirValue -1
    ${EndIf}
    StrCmp $DataDirValue $INSTDIR data_dir_invalid
    StrCpy $3 "$INSTDIR\"
    StrLen $1 $3
    StrCpy $2 $DataDirValue $1
    StrCmp $2 $3 data_dir_invalid
    Return
    data_dir_invalid:
      MessageBox MB_OK|MB_ICONEXCLAMATION "数据保存目录不能是软件安装目录，也不能位于安装目录内部，请换一个位置。"
      Abort
  FunctionEnd

  !macro customPageAfterChangeDir
    Page custom InstallDirPageCreate InstallDirPageLeave
    Page custom DataDirPageCreate DataDirPageLeave
  !macroend

  !macro customInstall
    ${If} $DataDirValue != ""
      SetShellVarContext current
      CreateDirectory "$APPDATA\${APP_SUBDIR}"
      FileOpen $0 "$APPDATA\${APP_SUBDIR}\data-dir.txt" w
      FileWrite $0 $DataDirValue
      FileClose $0
      SetShellVarContext all
    ${EndIf}
    Delete "$INSTDIR\data-dir.txt"
  !macroend
!endif
