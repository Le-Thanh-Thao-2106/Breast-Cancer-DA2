from fastapi.testclient import TestClient
from app.accounts import web_origin
from app.main import app


client = TestClient(app)


def test_health():
    r = client.get("/health")

    assert r.status_code == 200
    assert r.json()["model_loaded"] is True


def test_predict_rejects_missing_features():
    r = client.post(
        "/predict",
        json={
            "features": {
                "mean radius": 10.0
            }
        }
    )

    assert r.status_code == 422


def test_metadata_has_30_features():
    r = client.get("/metadata")

    assert r.status_code == 200
    assert len(r.json()["feature_names"]) == 30


def test_account_and_history_require_session():
    assert client.get('/login.html').status_code == 404
    assert client.get('/account/profile').status_code == 401
    assert client.get('/history/sessions').status_code == 401
    assert client.get('/admin/overview').status_code == 401


def test_account_validation_does_not_echo_password():
    password = 'short'
    response = client.post('/account/register', json={
        'email': 'new@example.com', 'full_name': 'New', 'password': password,
    })
    assert response.status_code == 422
    assert password not in response.text


def test_cross_site_login_is_rejected():
    response = client.post('/account/login',
        headers={'Origin': 'https://elsewhere.example'},
        json={'email': 'new@example.com', 'password': 'some-password'},
    )
    assert response.status_code == 403


def test_static_breastcare_site_can_call_account_api():
    response = client.options('/account/profile', headers={
        'Origin': web_origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
    })
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == web_origin

    response = client.get('/account/profile', headers={
        'Origin': web_origin, 'Sec-Fetch-Site': 'cross-site',
    })
    assert response.status_code == 401
    assert response.headers['access-control-allow-origin'] == web_origin
