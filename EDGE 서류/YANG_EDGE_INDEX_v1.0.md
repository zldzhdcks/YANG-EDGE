# YANG_EDGE_INDEX

Version: 1.0.0

## 목적

새 채팅에서 AI가 읽어야 하는 **문서 순서**를 정의한다.  
상세 내용은 각 문서를 따르고, 이 파일은 진입 순서만 고정한다.

폴더: `EDGE 서류/`

---

# 읽기 순서 (필수)

1. `CHAT_BOOTSTRAP_v1.0.md`
2. `PROJECT_CONSTITUTION_v1.0.md`
3. `PROJECT_STATUS_v1.0.md`
4. `RESEARCH_POLICY_v1.0.md`
5. `PROVIDER_POLICY_v1.0.md`
6. `WORKFLOW_RULES_v1.0.md`
7. `DECISION_LOG_v1.0.md`
8. `CURRENT_ARCHITECTURE_v1.0.md` *(필요 시)*
9. `CHANGELOG_v1.0.md`
10. `LESSONS_LEARNED_v1.0.md`
11. `KNOWN_ISSUES_v1.0.md`
12. `NEXT_SESSION_v1.0.md`

---

# 보조 / 레거시

| 파일 | 역할 |
|------|------|
| `YANG EDGE HANDOVER.md` | 상세 인수인계 (장문). INDEX·STATUS로 요약 진입 후 필요 시만 심화 |

---

# 폐지·통합 (v1 Documentation Refactoring)

| 구 문서 | 처리 |
|---------|------|
| `PROJECT_PROGRESS_v1.0.md` | → `PROJECT_STATUS_v1.0.md` 통합 후 삭제 |
| `PROJECT_STATE_v1.0.md` | → `PROJECT_STATUS_v1.0.md` 통합 후 삭제 |
| `TRANSFER_NOTES_v1.0.md` | → `NEXT_SESSION_v1.0.md` 통합 후 삭제 |

---

# 유지 문서

- CHAT_BOOTSTRAP
- PROJECT_CONSTITUTION
- RESEARCH_POLICY
- WORKFLOW_RULES
- CURRENT_ARCHITECTURE
- DECISION_LOG
- LESSONS_LEARNED
- CHANGELOG
- KNOWN_ISSUES
- NEXT_SESSION
- PROJECT_STATUS *(신규 통합)*
- PROVIDER_POLICY *(신규)*
- YANG_EDGE_INDEX *(본 문서)*

---

# 규칙

- 새 채팅은 본 INDEX 순서를 따른다.
- 문서 구조 변경은 `EDGE 서류/` 내부에서만 한다.
- Prediction / Engine / Dataset / Provider 코드·Artifact는 문서 리팩터링으로 변경하지 않는다.
