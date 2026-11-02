# 구버전 API 원본 보관 — 2026-11-02

이 폴더의 Python 파일은 과거 코드의 출처 기록이며 실행 API가 아니다. `backend/api/routes`에서 제거했고 기본 앱은 이 모듈을 import하지 않는다. 고정 성능·중요도·샘플 영상·임의 확률/신뢰도·가상 시퀀스는 현재 모델의 근거로 사용하지 않는다.

원본 경로·기준 커밋·파일 해시는 [provenance.json](provenance.json)에 있다. 캡처한 작업 파일의 바이트를 보존했으며 Git의 정규화된 blob 해시도 함께 기록한다. 모델 바이너리와 과거 발표 자료는 기존 위치에 보존한다.

기존 13개 API 주소는 현재 서버에서 HTTP 410과 폐기 안내를 반환한다. 현재 계약은 `/predict/t0-verified`, 평가 보고서는 `/predict/t0-verified/evaluation`, 실제 관측 자료는 `/eda/summary`·`/sustain/summary`·`/youtube/live/bulk`를 사용한다. 현재 중요도 API `/feature/importance`는 미산출 상태를 명시한다.
