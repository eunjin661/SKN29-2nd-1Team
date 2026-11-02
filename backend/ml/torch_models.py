"""CPU reproduction of the author's categorical embedding MLP.

Source: mlp_clf_tdi.py and mlp_vs_tabnet_clf_comparison.ipynb from the author's
previous-laptop backup. Network structure is preserved; data preparation and
validation now follow the shared v2 contract.
"""
from __future__ import annotations

import copy
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .data_contract import NUMERIC_FEATURES


class EmbeddingMLP(nn.Module):
    def __init__(self, category_count: int, numeric_count: int):
        super().__init__()
        self.embedding = nn.Embedding(category_count, 3)
        input_dim = numeric_count + 3
        layers, previous = [], input_dim
        for width in (256, 128, 64):
            layers.extend([nn.Linear(previous, width), nn.BatchNorm1d(width), nn.ReLU(), nn.Dropout(.3)])
            previous = width
        self.network = nn.Sequential(*layers)
        self.skip = nn.Linear(input_dim, 64)
        self.output = nn.Linear(64, 1)

    def forward(self, category, numeric):
        value = torch.cat([self.embedding(category), numeric], dim=1)
        return self.output(self.network(value) + self.skip(value)).squeeze(1)


def encode(frame, state):
    categories = frame.category_group.map(state["vocabulary"]).fillna(0).to_numpy(dtype="int64")
    numeric = state["numeric"].transform(frame[list(NUMERIC_FEATURES)]).astype("float32")
    return torch.from_numpy(categories), torch.from_numpy(numeric)


def probabilities(model, frame, state):
    model.eval()
    category, numeric = encode(frame, state)
    result = []
    with torch.inference_mode():
        for start in range(0, len(frame), 1024):
            result.extend(torch.sigmoid(model(category[start:start+1024], numeric[start:start+1024])).numpy())
    return np.asarray(result, dtype=float)


def train_embedding(features, targets, *, seed=42, epochs=80, threads=4):
    torch.set_num_threads(threads)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    np.random.seed(seed)
    numeric = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
    numeric.fit(features["train"][list(NUMERIC_FEATURES)])
    vocabulary = {value: i + 1 for i, value in enumerate(sorted(features["train"].category_group.unique()))}
    state = {"numeric": numeric, "vocabulary": vocabulary, "category_count": len(vocabulary) + 1, "numeric_count": len(NUMERIC_FEATURES)}
    model = EmbeddingMLP(state["category_count"], state["numeric_count"])
    category, values = encode(features["train"], state)
    labels = torch.tensor(targets["train"], dtype=torch.float32)
    generator = torch.Generator().manual_seed(seed)
    batch_size = min(256, len(labels))
    if batch_size < 2:
        raise ValueError("Embedding MLP requires at least two training events")
    loader = DataLoader(TensorDataset(category, values, labels), batch_size=batch_size, shuffle=True, drop_last=True, generator=generator)
    weight = float((labels == 0).sum() / (labels == 1).sum())
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([weight]))
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.0001)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=.5, patience=5)
    best_auc, best_epoch, stale, best_state, history = -1., 0, 0, None, []
    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        for category, values, labels in loader:
            optimizer.zero_grad()
            loss = criterion(model(category, values), labels)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.)
            optimizer.step()
            losses.append(float(loss.detach()))
        score = float(roc_auc_score(targets["validation"], probabilities(model, features["validation"], state)))
        history.append({"epoch": epoch, "train_loss": float(np.mean(losses)), "validation_auc": score})
        scheduler.step(score)
        if score > best_auc:
            best_auc, best_epoch, stale, best_state = score, epoch, 0, copy.deepcopy(model.state_dict())
        else:
            stale += 1
        if epoch == 1 or epoch % 10 == 0:
            print(f"embedding_mlp epoch={epoch} validation_auc={score:.4f}", flush=True)
        if stale >= 12:
            break
    model.load_state_dict(best_state)
    state["training"] = {"seed": seed, "epochs_run": len(history), "best_epoch": best_epoch, "pos_weight_train_only": weight, "history": history}
    return model, state
