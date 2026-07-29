# retirement-frontend 고도화 방안 (3Dynr 참고)

> **성격:** 래피드 3Dynr와의 **협력·공동 제품 계획이 아님**.  
> 벤치마크를 참고해 **클라이언트 UX**를 세후 월 현금흐름·인출 중심으로 고도화하는 내부 계획.  
> 백엔드 계획: `retirement-backend-product-plan.md` (Phase A~E와 **페어**)  
> 가치·가격: `product-value-estimate.md`  
> 참고: [Latpeed 3Dynr](https://www.latpeed.com/products/3Dynr) · `product-summary.md`  
> 정리일: 2026-07-24

## 기본 정보

| 항목 | 내용 |
|------|------|
| 대상 | retirement-frontend (클라이언트) |
| 목적 | 「한 페이지 숫자」를 **입력 → 계산 → 시나리오 비교**로 보이게 |
| 배포 | https://retirement-frontend-cjy.vercel.app |
| 스택 | React 19 · Vite · RR7 · Redux · Axios · Zod · MSW · Vitest |
| API | `VITE_API_BASE_URL` → retirement-backend |

## 왜 참고하는가

백엔드가 세후 월 CF 엔진을 키워도, 화면이 **개별 시뮬 메뉴**에 머무르면 제품 메시지가 안 바뀐다.  
FE 고도화 초점: **체크리스트형 입력 + 세후 월 CF 대시보드 + 시나리오 A/B/C**.

## 참고 범위 / 비범위

| 포함 | 제외 |
|------|------|
| 화면·폼·결과 UX, API 연동, 인증 UX | 래피드 판매·콘텐츠 복제 |
| 노션/CSV 체크리스트를 UI 초안으로 사용 | 세무 자문 UI 주장 |
| MSW로 BE 미완성 API 병행 개발 | 결제·구독 |

## 현재 MVP vs 고도화 목표

| 영역 | 지금 | 고도화 목표 |
|------|------|-------------|
| 진단 플로우 | profile → cashflow → scenario → medical → result | **세후 CF 체크리스트**가 중심 축 |
| cashflow / cashflow-plan | 입력·20년 요약 존재 | 세전/세후·숨은지출·갭·버킷 명시 |
| simulation/* | 건보·국민연금·ISA·IRP 등 **단건 메뉴** | CF 타임라인에 **합류·요약** |
| Auth | JWT → `localStorage` | Access memory + Refresh cookie (BE Phase E와 맞춤) |
| 결과 | Projection / Summary | 「한 줄 처방」+ 시나리오 비교 카드 |

## 고도화 우선 축 (UI)

1. **세후 월 CF**를 홈/결과의 주 지표로  
2. **1,500만 여유** 표시·경고  
3. **인출 순서·인출률** 가시화  
4. **국민연금 전/후**(브릿지) 구간 타임라인  
5. **건보·피부양**을 별도 라인으로  
6. **3버킷** 현황 vs 목표

## 단계별 실행 계획 (BE와 페어)

### Phase A — IA·폼 계약 (BE A와 동시)
- 체크리스트/노션 → 화면 필드 매핑 (Zod 스키마 초안)
- 샘플 3케이스를 UI 프리셋·스토리/픽스처로
- `/cashflow`·신규 CF 허브 정보구조(IA) 스케치

### Phase B — 세후 CF UX (BE B API 연동)
- CF 입력 화면: 수입(세전/세후)·숨은지출·갭
- 결과: 목표 월 순CF vs 확정성 합 vs 갭
- API 없으면 MSW로 계약 고정 후 BE 붙이기

### Phase C — 세금·인출·시나리오 UX (BE C)
- 1,500만 한도 게이지 / 초과 시 선택 UI
- 인출 순서·인출률 4~4.5% 표시
- 시나리오 A/B/C 비교 (`샘플3케이스` 9_대시보드·5_시나리오 참고)

### Phase D — 기존 시뮬 합류 UX (BE D)
- simulation 단건 결과를 CF 타임라인 카드로 연결
- 대시보드: 「개별 시뮬」+「월 CF 한 장」통합

### Phase E — 인증 UX (BE E와 병행)
- `localStorage` 토큰 제거 → Access memory
- refresh `credentials` + 401 재시도
- signup 무토큰 → 로그인 유도 (강의 표준)

## 타임라인 (제안)

> 기준일: **2026-07-24** · BE와 **같은 창** · FE는 API 대기 구간을 MSW로 메움

| Phase | 기간 | 달력 (제안) | 산출물 | BE 의존 |
|-------|------|-------------|--------|---------|
| **A** IA·폼 | 3~5일 | 7/25 ~ 7/29 | 필드 맵, Zod 초안, 프리셋 | BE A와 동시 |
| **B** CF UX | 1.5~2주 | 7/30 ~ 8/12 | CF 입력·갭 결과 화면 | BE B (MSW 병행) |
| **C** 세금·시나리오 | 1.5~2주 | 8/13 ~ 8/26 | 한도·인출·A/B/C UI | BE C |
| **D** 시뮬 합류 | 1주 | 8/27 ~ 9/02 | 통합 대시보드 | BE D |
| **E** 인증 UX | 1주 (병행) | 7/30 ~ 8/05 | memory + refresh 흐름 | BE E |

```text
7/25        8/01        8/08        8/15        8/22        8/29        9/02
 |-- A --|  (FE+BE)
      |-------- B  CF UX --------|
                |-------- C  시나리오 UX --------|
                                              |--- D ---|
      |-- E 인증 UX (병행) --|
```

### 마일스톤

| 날짜 | FE 체크 |
|------|---------|
| **7/29** | A — Case0 프리셋으로 폼 한 바퀴 |
| **8/12** | B — 세후 월 CF·갭 화면 |
| **8/26** | C — 시나리오 비교 + 1,500만 UI |
| **9/02** | D — 시뮬→CF 합류 대시보드 |
| **E** | B 주간에 인증 UX 병행 |

### 조절

- **빠른 모드:** A 2일 → B·C를 “CF 한 장 + 시나리오 2개”로 축소
- BE 지연 시: MSW로 B/C UI 선행, API만 교체

## 화면 매핑 (현재 → 고도화)

| 현재 경로 | 고도화 역할 |
|-----------|-------------|
| `/cashflow`, `/cashflow-plan` | 세후 CF·갭·버킷 **허브**로 강화 |
| `/result`, `/summary` | 한 줄 처방 + 시나리오 카드 |
| `/simulation/*` | 단건 유지 + CF로 **딥링크·요약 합류** |
| `/portfolio` | 3버킷·인출 재원 현황 |
| `/signin`, `/signup` | Phase E 인증 표준 |

## 의도적으로 나중에

- 모바일 전용 네비 개편
- 온보딩 튜토리얼·PDF보내기
- 다크모드·대규모 디자인 시스템

## 관련 파일

| 파일 | 용도 |
|------|------|
| `retirement-backend-product-plan.md` | API 고도화 (페어) |
| `product-summary.md` | 3Dynr 참고 요약 |
| `은퇴현금흐름_*.csv/md` | 폼·프리셋·검증 힌트 |

## 면책

교육·기획·시뮬 UX 고도화 참고용이다. 3Dynr 및 판매자와의 제휴를 의미하지 않는다.
