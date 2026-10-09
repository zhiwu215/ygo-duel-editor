!ifndef BUILD_UNINSTALLER
  !include LogicLib.nsh
  !include nsDialogs.nsh

  Var DataDirValue
  Var DataDirField

  !macro customInit
    StrCpy $DataDirValue "$LOCALAPPDATA\ygo-duel-editor-data"
  !macroend

  Function DataDirBrowse
    nsDialogs::SelectFolderDialog "选择数据保存目录" "$DataDirValue"
    Pop $0
    ${If} $0 != "error"
      StrCpy $DataDirValue $0
      ${NSD_SetText} $DataDirField $DataDirValue
    ${EndIf}
  FunctionEnd

  Function DataDirPageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == "error"
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 30u "数据保存目录：卸载程序不会删除此目录"
    Pop $0

    ${NSD_CreateText} 0 34u 76% 13u "$DataDirValue"
    Pop $DataDirField

    ${NSD_CreateButton} 78% 34u 22% 13u "浏览..."
    Pop $0
    ${NSD_OnClick} $0 DataDirBrowse

    nsDialogs::Show
  FunctionEnd

  Function DataDirPageLeave
    ${NSD_GetText} $DataDirField $DataDirValue
    ${If} $DataDirValue == ""
      StrCpy $DataDirValue "$LOCALAPPDATA\ygo-duel-editor-data"
    ${EndIf}
  FunctionEnd

  !macro customPageAfterChangeDir
    !define MUI_PAGE_HEADER_TEXT "数据保存目录"
    !define MUI_PAGE_HEADER_SUBTEXT "卸载程序不会删除此目录"
    Page custom DataDirPageCreate DataDirPageLeave
    !undef MUI_PAGE_HEADER_TEXT
    !undef MUI_PAGE_HEADER_SUBTEXT
  !macroend

  !macro customInstall
    FileOpen $0 "$INSTDIR\data-dir.txt" w
    FileWrite $0 $DataDirValue
    FileClose $0
  !macroend
!endif
