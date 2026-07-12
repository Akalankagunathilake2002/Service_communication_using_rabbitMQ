import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

N_SAMPLES = 3000
SEED = 42
RISK_FLAG_THRESHOLD = 0.6


def _generate_synthetic_dataset(n: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)

    total = rng.lognormal(mean=3.5, sigma=0.6, size=n)
    item_count = rng.integers(1, 6, size=n)
    total_qty = item_count * rng.integers(1, 4, size=n)
    avg_unit_price = total / total_qty
    velocity = rng.poisson(lam=0.5, size=n)

    X = np.column_stack([total, item_count, total_qty, avg_unit_price, velocity]).astype(float)

    def zscore(col: np.ndarray) -> np.ndarray:
        return (col - col.mean()) / (col.std() + 1e-9)

    # Real logistic data-generating process (not an ad-hoc rule), so LogisticRegression
    # is the correct model family for this data, not just one fit on top of it.
    z = (
        1.1 * zscore(total)
        + 0.9 * zscore(avg_unit_price)
        + 1.4 * zscore(velocity)
        + rng.normal(0, 1.0, size=n)
        - 2.0  # intercept: centers the base fraud rate around ~10-15%
    )
    p = 1 / (1 + np.exp(-z))
    y = rng.binomial(1, p)

    return X, y


def _train_model():
    X, y = _generate_synthetic_dataset(N_SAMPLES, SEED)
    pipeline = make_pipeline(StandardScaler(), LogisticRegression(random_state=SEED))
    pipeline.fit(X, y)
    return pipeline


_model = _train_model()


def extract_features(order_payload: dict, velocity: int) -> np.ndarray:
    total = float(order_payload.get("total") or 0.0)
    items = order_payload.get("items") or []
    item_count = len(items) or 1
    total_qty = sum(int(item.get("qty", 1)) for item in items) or 1
    avg_unit_price = total / total_qty

    return np.array([[total, item_count, total_qty, avg_unit_price, velocity]], dtype=float)


def predict_risk(features: np.ndarray) -> float:
    return float(_model.predict_proba(features)[0][1])
