from fastapi.testclient import TestClient
from sklearn.datasets import load_breast_cancer
from app.accounts import identity_origin, web_origin
from app.main import app


client = TestClient(app)


def test_batch_limit_and_label_comparison():
    data = load_breast_cancer()
    sample = dict(zip(data.feature_names, data.data[0]))
    request = {'samples': [sample] * 600, 'kernels': ['RBF'], 'labels': [0, 1] * 300}
    response = client.post('/predict/batch/compare', json=request)
    assert response.status_code == 200
    result = response.json()['results'][0]
    assert len(result['predictions']) == 600
    assert result['evaluation'] == {'correct': 300, 'incorrect': 300, 'accuracy': 0.5}

    invalid_size = client.post('/predict/batch/compare', json={**request, 'samples': [sample] * 601})
    invalid_label = client.post('/predict/batch/compare', json={**request, 'samples': [sample], 'labels': [2]})
    assert invalid_size.status_code == 422
    assert invalid_label.status_code == 422


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


def test_identity_center_can_start_but_cannot_receive_a_session():
    headers = {'Origin': identity_origin, 'Sec-Fetch-Site': 'cross-site'}
    preflight = client.options('/account/login', headers={
        **headers,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
    })
    assert preflight.status_code == 200
    assert preflight.headers['access-control-allow-origin'] == identity_origin

    login = client.post('/account/login', headers=headers, json={
        'email': 'test@example.com', 'password': 'test-password',
    })
    assert login.status_code == 422
    assert client.get('/account/profile', headers=headers).status_code == 403
    exchange = client.post('/account/exchange', headers=headers, json={
        'code': 'x' * 43, 'verifier': 'y' * 43,
    })
    assert exchange.status_code == 403

    response = client.get('/account/profile', headers={
        'Origin': web_origin, 'Sec-Fetch-Site': 'cross-site',
    })
    assert response.status_code == 401
    assert response.headers['access-control-allow-origin'] == web_origin
