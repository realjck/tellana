import io

# Minimal valid 1×1 PNG
MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_upload_valid_image(client):
    res = client.post(
        "/api/assets/upload",
        files={"file": ("test.png", io.BytesIO(MINIMAL_PNG), "image/png")},
    )
    assert res.status_code == 200
    assert res.json()["url"].startswith("/uploads/")
    assert res.json()["url"].endswith(".png")


def test_upload_invalid_type(client):
    res = client.post(
        "/api/assets/upload",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert res.status_code == 400


def test_upload_writes_file(client, tmp_path):
    """Uploaded file must be present on disk."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("img.png", io.BytesIO(MINIMAL_PNG), "image/png")},
    )
    filename = res.json()["url"].split("/")[-1]
    assert (tmp_path / filename).exists()
