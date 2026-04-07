import io

# Minimal valid 1×1 PNG
MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)

# Minimal JPEG header (SOI + APP0 marker)
MINIMAL_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16


def test_upload_valid_image(client):
    res = client.post(
        "/api/assets/upload",
        files={"file": ("test.png", io.BytesIO(MINIMAL_PNG), "image/png")},
    )
    assert res.status_code == 200
    assert res.json()["url"].startswith("/uploads/")
    assert res.json()["url"].endswith(".png")


def test_upload_invalid_content_type_rejected_by_client_header(client):
    """Client-declared PDF → rejected (magic bytes check: no valid image signature)."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 fake content"), "application/pdf")},
    )
    assert res.status_code == 400


def test_upload_magic_bytes_override_client_header(client):
    """PNG bytes sent with a spoofed application/pdf content_type must still be accepted."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("trick.pdf", io.BytesIO(MINIMAL_PNG), "application/pdf")},
    )
    # Magic bytes say PNG → accepted despite wrong declared type
    assert res.status_code == 200


def test_upload_pdf_bytes_with_image_type_rejected(client):
    """PDF bytes sent with image/png content_type must be rejected (bad magic bytes)."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("evil.png", io.BytesIO(b"%PDF-1.4 fake content"), "image/png")},
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
