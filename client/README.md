# SurveyKing client

## Remote backend development proxy

The local editable pages can use the deployed backend without starting the
Java service:

```bash
node client/dev-server.js
```

Open `http://127.0.0.1:4173/user/login`. The proxy forwards `/api/*` to
`http://www.dxx.zone:1991` and keeps the login cookie on the local origin.
Use `BACKEND_URL=https://test.huaiyu.cn node client/dev-server.js` to target a
different deployed backend.

## Editable login page

The editable login page lives in `client/login/`. It is intentionally separate
from the generated Umi files under `server/api/src/main/resources/static/`.

The page calls the existing `/api/system` and `/api/public/login` endpoints
and keeps the backend's RSA password contract. The selected API base is saved
in local storage for subsequent pages; production deployment defaults to the
current origin.

After the page is verified, it can be moved into the frontend build pipeline
and emitted to the backend static directory.

The editable home dashboard is in `client/home/`. It mirrors the current
navigation, overview counters, task tabs, refresh action, and quick-create
links. It uses `/api/currentUser`, `/api/userOverview`, `/api/system`, and the
task list endpoints when served behind the SurveyKing backend.
