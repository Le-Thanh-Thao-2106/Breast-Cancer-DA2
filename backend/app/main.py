from pathlib import Path
import json, joblib
import  numpy as np

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# =========================
# Đường dẫn đến model
# =========================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "artifacts" / "breast_cancer_svm.joblib"
METADATA_PATH = BASE_DIR / "artifacts" / "metadata.json"


# =========================
# Load model và metadata
# =========================

model = joblib.load(MODEL_PATH)

with open(METADATA_PATH, "r", encoding="utf-8") as f:
    metadata = json.load(f)


FEATURE_NAMES = metadata["feature_names"]


# =========================
# Khởi tạo FastAPI
# =========================

app = FastAPI(
    title="Breast Cancer SVM API",
    version=metadata["model_version"],
    description="Educational demonstration only"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Request / Response
# =========================

class PredictionRequest(BaseModel):
    features: dict[str, float]


class PredictionResponse(BaseModel):
    predicted_class: int
    predicted_label: str
    probability_malignant: float
    probability_benign: float
    model_version: str
    warning: str


# =========================
# Kiểm tra dữ liệu đầu vào
# =========================

def build_vector(features: dict[str, float]):

    expected = set(FEATURE_NAMES)
    received = set(features.keys())

    missing = expected - received
    extra = received - expected

    if missing or extra:
        raise HTTPException(
            status_code=422,
            detail={
                "missing_features": sorted(missing),
                "extra_features": sorted(extra)
            }
        )

    values = []

    for name in FEATURE_NAMES:

        value = features[name]

        if not np.isfinite(value):
            raise HTTPException(
                status_code=422,
                detail=f"Feature '{name}' must be finite."
            )

        values.append(value)

    return np.array(values).reshape(1, -1)


# =========================
# API
# =========================

@app.get("/")
def root():

    return {
        "message": "Breast Cancer SVM API",
        "version": metadata["model_version"]
    }


@app.get("/health")
def health():

    return {
        "status": "ok",
        "model_loaded": model is not None,
        "model_version": metadata["model_version"]
    }


@app.get("/metadata")
def get_metadata():

    return metadata


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):

    X = build_vector(request.features)

    prediction = int(model.predict(X)[0])

    probabilities = model.predict_proba(X)[0]

    probability_malignant = float(probabilities[0])
    probability_benign = float(probabilities[1])

    label = metadata["class_mapping"][str(prediction)]

    return {
        "predicted_class": prediction,
        "predicted_label": label,
        "probability_malignant": probability_malignant,
        "probability_benign": probability_benign,
        "model_version": metadata["model_version"],
        "warning": metadata["warning"]
    }

class BatchPredictionRequest(BaseModel):
    samples: list[dict[str, float]]


@app.post("/predict/batch")
def predict_batch(request: BatchPredictionRequest):
    if not 1 <= len(request.samples) <= 200:
        raise HTTPException(status_code=422, detail="Provide 1 to 200 samples.")
    vectors = [build_vector(sample) for sample in request.samples]
    X = np.vstack(vectors)
    predictions = model.predict(X)
    probabilities = model.predict_proba(X)
    results = []
    for prediction, probability in zip(predictions, probabilities):
        cls = int(prediction)
        results.append({
            "predicted_class": cls,
            "predicted_label": metadata["class_mapping"][str(cls)],
            "probability_malignant": float(probability[0]),
            "probability_benign": float(probability[1]),
            "model_version": metadata["model_version"],
            "warning": metadata["warning"]
        })
    return {"total": len(results), "results": results}


# Benchmark giáo dục: huấn luyện 4 SVM độc lập trên cùng phép chia dữ liệu.
# Không thay đổi mô hình RBF đang được triển khai tại /predict.
from functools import lru_cache
from time import perf_counter

@app.get('/benchmark')
def svm_benchmark():
    return _benchmark_results()

@lru_cache(maxsize=1)
def _benchmark_results():
    from sklearn.datasets import load_breast_cancer
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.svm import SVC
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, roc_auc_score
    dataset=load_breast_cancer()
    x_train,x_test,y_train,y_test=train_test_split(dataset.data,dataset.target,test_size=0.2,random_state=42,stratify=dataset.target)
    results=[]
    for name,kernel in [('Linear','linear'),('RBF','rbf'),('Polynomial','poly'),('Sigmoid','sigmoid')]:
        classifier=make_pipeline(StandardScaler(),SVC(kernel=kernel,degree=3,gamma='scale',probability=True,random_state=42))
        t0=perf_counter();classifier.fit(x_train,y_train);training_ms=(perf_counter()-t0)*1000
        t1=perf_counter();prediction=classifier.predict(x_test);predict_ms=(perf_counter()-t1)*1000
        score=classifier.predict_proba(x_test)[:,1]
        results.append({'kernel':name,'accuracy':round(float(accuracy_score(y_test,prediction)),4),
            'precision':round(float(precision_score(y_test,prediction,average='macro',zero_division=0)),4),
            'recall':round(float(recall_score(y_test,prediction,average='macro',zero_division=0)),4),
            'f1':round(float(f1_score(y_test,prediction,average='macro',zero_division=0)),4),
            'auc':round(float(roc_auc_score(y_test,score)),4),
            'confusion_matrix':confusion_matrix(y_test,prediction).tolist(),
            'training_ms':round(training_ms,2),'prediction_ms':round(predict_ms,2)})
    return {'dataset':'Breast Cancer Wisconsin Diagnostic (sklearn)','total_samples':len(dataset.target),
      'train_samples':len(y_train),'test_samples':len(y_test),'split':'80/20, stratify, random_state=42',
      'metrics_average':'macro','positive_class':1,'results':results,
      'note':'Thời gian đo trên máy chủ, thay đổi theo môi trường. Đây là benchmark riêng, không phải kết quả mô hình đã triển khai.'}


# Các mô hình đối chiếu huấn luyện trên WDBC, cùng phép chia cố định.
# Không thay đổi endpoint /predict mặc định đang triển khai.
@lru_cache(maxsize=1)
def _comparison_models():
    from sklearn.datasets import load_breast_cancer
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.svm import SVC
    dataset=load_breast_cancer()
    x_train,_,y_train,_=train_test_split(dataset.data,dataset.target,test_size=.2,random_state=42,stratify=dataset.target)
    return {name:make_pipeline(StandardScaler(),SVC(kernel=kernel,degree=3,gamma='scale',probability=True,random_state=42)).fit(x_train,y_train)
            for name,kernel in [('Linear','linear'),('RBF','rbf'),('Polynomial','poly'),('Sigmoid','sigmoid')]}

class CompareRequest(BaseModel):
    features: dict[str,float]
    kernels: list[str]

class CompareBatchRequest(BaseModel):
    samples: list[dict[str,float]]
    kernels: list[str]

def _validate_kernels(kernels):
    if not kernels or len(kernels)>4 or len(set(kernels))!=len(kernels) or any(k not in ('Linear','RBF','Polynomial','Sigmoid') for k in kernels):
        raise HTTPException(status_code=422,detail='Chọn 1–4 kernel hợp lệ, không trùng lặp.')

def _compare_matrix(X,kernels):
    _validate_kernels(kernels)
    # sklearn WDBC trật tự đặc trưng khớp metadata của dự án.
    if X.shape[1]!=30:
        raise HTTPException(status_code=422,detail='Cần đúng 30 đặc trưng.')
    models=_comparison_models()
    results=[]
    for name in kernels:
        t0=perf_counter()
        predicted=models[name].predict(X)
        probabilities=models[name].predict_proba(X)
        elapsed=(perf_counter()-t0)*1000
        results.append({'kernel':name,'elapsed_ms':round(elapsed,3),
            'predictions':[{'predicted_class':int(c),'predicted_label':metadata['class_mapping'][str(int(c))],
                'probability_malignant':float(p[0]),'probability_benign':float(p[1])} for c,p in zip(predicted,probabilities)]})
    return {'total':len(X),'results':results,'note':'Các kernel được huấn luyện độc lập trên tập WDBC train 80%. Thời gian chỉ tính suy luận trên máy chủ.'}

@app.post('/predict/compare')
def predict_compare(req:CompareRequest):
    return _compare_matrix(build_vector(req.features),req.kernels)

@app.post('/predict/batch/compare')
def predict_batch_compare(req:CompareBatchRequest):
    if not 1<=len(req.samples)<=200:
        raise HTTPException(status_code=422,detail='Chọn từ 1 đến 200 mẫu.')
    return _compare_matrix(np.vstack([build_vector(x) for x in req.samples]),req.kernels)

# Xác minh OAuth access token ở phía máy chủ, không tin email do trình duyệt gửi lên.
import os
from urllib.request import Request as UrlRequest, urlopen
from fastapi import Header

@app.get('/admin/overview')
def admin_overview(authorization:str=Header(default='')):
    user = _identity(authorization)
    _require_admin(user)
    return {'admin_email':user['email'],'model_version':metadata['model_version'],
        'model_count':4,'benchmark':_benchmark_results(),
        'note':'Số người dùng và lịch sử toàn hệ thống cần bảng Supabase và API thống kê riêng có RLS; không sử dụng số liệu giả.'}


# DA2 cloud history: OAuth bearer validated server-side; Supabase service key only on server.
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from fastapi import Body
from pydantic import Field

def _identity(authorization):
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Cần đăng nhập Identity Center.')
    url=os.environ.get('SUPABASE_URL','').rstrip('/')
    if not url: raise HTTPException(status_code=503,detail='Thiếu SUPABASE_URL trên backend.')
    try:
        req=UrlRequest(url+'/auth/v1/oauth/userinfo',headers={'Authorization':authorization})
        with urlopen(req,timeout=8) as response: user=json.load(response)
        if not user.get('sub'):
            raise ValueError('Invalid identity')
        return user
    except Exception:
        raise HTTPException(status_code=401,detail='Phiên đăng nhập không hợp lệ.')

def _is_admin(user):
    admin_id = os.environ.get('DA2_ADMIN_USER_ID', '').strip().lower()
    return bool(admin_id) and user.get('sub') == admin_id


def _require_admin(user):
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail='Tài khoản không có quyền quản trị.')


@app.get('/account/profile')
def account_profile(authorization: str = Header(default='')):
    user = _identity(authorization)
    user_id = quote(user['sub'], safe='')
    profiles = _db('GET', f'profiles?select=full_name&id=eq.{user_id}&limit=1')
    profile = profiles[0] if profiles else {}
    return {
        'sub': user['sub'],
        'email': user.get('email', ''),
        'full_name': profile.get('full_name') or user.get('name'),
        'is_admin': _is_admin(user),
    }


def _db(method,path,payload=None):
    url=os.environ.get('SUPABASE_URL','').rstrip('/')
    key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY','')
    if not url or not key: raise HTTPException(status_code=503,detail='Backend chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
    headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'return=representation'}
    data=None if payload is None else json.dumps(payload).encode()
    try:
        req=UrlRequest(url+'/rest/v1/'+path,data=data,headers=headers,method=method)
        with urlopen(req,timeout=12) as response:return json.load(response)
    except HTTPError as e:
        raise HTTPException(status_code=502,detail='Supabase database error '+str(e.code))
    except (URLError,TimeoutError):
        raise HTTPException(status_code=502,detail='Không kết nối được Supabase.')


class HistorySession(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    type: str
    analyzedAt: str
    filename: str = Field(default='', max_length=255)
    sampleCount: int = Field(ge=1, le=200)
    kernels: list[str]
    summary: list[dict] | dict = Field(default_factory=list)
    results: list[dict] | dict = Field(default_factory=list)


@app.post('/history/sessions')
def create_session(
    session: HistorySession,
    authorization: str = Header(default='')
):
    user = _identity(authorization)

    if session.type not in ('single', 'batch'):
        raise HTTPException(
            status_code=422,
            detail='Loại phân tích không hợp lệ.'
        )

    _validate_kernels(session.kernels)

    if session.type == 'single':
        if session.sampleCount != 1:
            raise HTTPException(
                status_code=422,
                detail='Phân tích 1 mẫu phải có sampleCount = 1.'
            )
        if not isinstance(session.summary, dict) or not isinstance(session.results, dict):
            raise HTTPException(
                status_code=422,
                detail='Dữ liệu phân tích 1 mẫu không hợp lệ.'
            )
    else:
        if not isinstance(session.summary, list) or not isinstance(session.results, list):
            raise HTTPException(
                status_code=422,
                detail='Dữ liệu phân tích Batch không hợp lệ.'
            )
        if len(session.results) != len(session.kernels) or any(
            not isinstance(r, dict)
            or len(r.get('predictions', [])) != session.sampleCount
            for r in session.results
        ):
            raise HTTPException(
                status_code=422,
                detail='Số mẫu/kernel không khớp.'
            )

    record = {
        'id': session.id,
        'user_id': user['sub'],
        'user_email': user.get('email'),
        'kind': session.type,
        'filename': session.filename,
        'sample_count': session.sampleCount,
        'kernels': session.kernels,
        'summary': session.summary,
        'details': {
            'results': session.results,
            'analyzedAt': session.analyzedAt
        }
    }

    _db('POST', 'bc_analysis_sessions', record)

    return {'saved': True, 'id': session.id}

@app.get('/history/sessions')
def list_sessions(authorization:str=Header(default='')):
    user=_identity(authorization)
    path='bc_analysis_sessions?select=id,kind,created_at,filename,sample_count,kernels,summary,details&user_id=eq.'+quote(user['sub'],safe='')+'&order=created_at.desc&limit=200'
    return {'sessions':_db('GET',path)}


@app.delete('/history/sessions/{session_id}')
def delete_session(
    session_id: str,
    authorization: str = Header(default='')
):
    user = _identity(authorization)

    if not session_id or len(session_id) > 100:
        raise HTTPException(
            status_code=400,
            detail='ID phiên phân tích không hợp lệ.'
        )

    path = (
        'bc_analysis_sessions'
        '?id=eq.' + quote(session_id, safe='')
        + '&user_id=eq.' + quote(user['sub'], safe='')
    )

    _db('DELETE', path)

    return {
        'deleted': True,
        'id': session_id
    }

@app.get('/admin/statistics')
def admin_statistics(authorization:str=Header(default='')):
    user=_identity(authorization)
    _require_admin(user)
    sessions=_db('GET','bc_analysis_sessions?select=user_id,sample_count,kernels,summary&limit=10000')
    counts={k:0 for k in ['Linear','RBF','Polynomial','Sigmoid']}
    for sess in sessions:
        for k in sess.get('kernels',[]):
            if k in counts:counts[k]+=1
    return {'total_users_with_sessions':len(set(s['user_id'] for s in sessions)),'total_sessions':len(sessions),'total_samples':sum(s['sample_count'] for s in sessions),'kernel_usage':counts,'note':'Thống kê phiên đã lưu trong bc_analysis_sessions; không phải tổng người dùng đăng ký.'}
