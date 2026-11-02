> 2026-11-02 사용자 결정: PR 절차를 main 직접 반영으로 변경했다. [최신 반영 상태](MAIN_PUBLICATION_20261102.md)를 따른다. 아래는 10월 23일 당시의 공개 준비 기록이다.

> 이전 계획·실행 당시의 기록입니다. 현재 완료 상태·폐기 API·원격 검사는 [최신 마감 기록](CLOSURE_RESULTS_20261102.md)을 기준으로 확인하세요. 아래의 대기 문구·검사 개수·PR 계획은 당시 상태로 보존합니다.

# GitHub 공개 전 검토 목록

대상: [eunjin661/SKN29-2nd-1Team](https://github.com/eunjin661/SKN29-2nd-1Team), base `main`, head `improve/trendit-reproducibility`. 연결 사용자 eunjin661·push 권한·기본 브랜치의 SHA가 로컬 기준 f06c8175c0a2a6d611e21c9e72a9e0ca9e789a1c와 같음을 읽기 확인했다. 개인 포크에 PR을 준비하며 팀 원본 저장소는 수정하지 않는다.

## 검토할 변경 묶음

1. 입력·정답·분할·학습/추론의 T0 v2 계약, 레거시 누수 모델 자동 로딩 차단, CPU 잠금 파일.
2. API 상태·평가·관측 집계·캠페인 계산·진단 API와 관련 백엔드 검사.
3. 입력/결과 연결·실패 처리·실제 관측·가정 계산·모바일/다크 화면과 브라우저 검사.
4. 5시드/영상 재표집 소스·재현 안내·두 workflow·단계별 원시 근거·면접 원장·기존 발표 자료.
5. 추적하던 pyc 42개와 더 이상 사용하는 곳이 없는 고정 EDA 도우미 정리. 삭제 전 주요 소스는 증거 폴더에 보존했다.

실제 전체 경로·변경 상태는 [공개 대상 목록](followup_evidence/publication-inventory.json), 코드·문서 사본의 해시는 [최종 소스 목록](followup_evidence/final-source-manifest.json)에 있다. [PR 설명 초안](PULL_REQUEST_DRAFT_20261023.md)과 [검증 결과](FOLLOWUP_RESULTS_20261023.md)를 함께 검토한다.

`.env`, 실제 키·비밀번호, venv/node_modules, 새 학습 가중치·원자료 사본·로컬 ZIP은 공개 변경 대상에서 제외한다. 기존 저장소에 있던 정제 parquet는 재현 입력으로 유지하며 데이터 SHA를 확인한다. 보고서·원시 예측·실험 이력은 근거 자료다. 과거 팀 역할과 이번 보완 기여를 README에서 구분한다.

사용자가 공개를 승인한 후 목적별 커밋과 브랜치를 올리고 개인 포크 main에 PR을 만든다. 원격 Actions의 실제 결과는 그때 확인한다. 현재 원격 검사 통과나 배포 완료를 주장하지 않는다. 병합·서비스 배포는 별도 결정이다.
