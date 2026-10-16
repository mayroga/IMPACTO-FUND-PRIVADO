require_login(request)
    with db_connect() as db:
        db.execute("INSERT INTO intake_parts(slot,title,content,updated_at) VALUES(?,?,?,?) ON CONFLICT(slot) DO UPDATE SET title=excluded.title,content=excluded.content,updated_at=excluded.updated_at", (body.slot, body.title.strip() or f"Parte {body.slot}", body.content, date.today().isoformat()))
        total = db.execute("SELECT COALESCE(SUM(LENGTH(content)),0) AS n FROM intake_parts").fetchone()["n"]
        if total > MAX_COMBINED_PART_CHARS:
            db.execute("DELETE FROM intake_parts WHERE slot=?", (body.slot,))
            raise HTTPException(413, "El conjunto supera el límite de texto permitido. Divide o reduce el contenido antes de guardarlo.")
        count = db.execute("SELECT COUNT(*) AS n FROM intake_parts").fetchone()["n"]
    return {"ok": True, "saved_slot": body.slot, "parts_count": count, "total_chars": total}

@app.delete("/api/intake/parts/{slot}")
async def delete_intake_part(slot: int, request: Request):
    require_login(request)
    with db_connect() as db: db.execute("DELETE FROM intake_parts WHERE slot=?", (slot,))
    return {"ok": True}

@app.post("/api/intake/assemble")
async def assemble_intake(request: Request):
    require_login(request)
    with db_connect() as db: rows = db.execute("SELECT slot,title,content FROM intake_parts ORDER BY slot").fetchall()
    if not rows: raise HTTPException(400, "No hay partes guardadas todavía.")
    text = "\n\n".join(f"--- {row['title']} (parte {row['slot']}) ---\n{row['content']}" for row in rows)
    if len(text) > MAX_COMBINED_PART_CHARS: raise HTTPException(413, "El texto combinado supera el límite permitido.")
    return {"ok": True, "text": text, "parts_count": len(rows), "total_chars": len(text)}

@app.post("/api/outputs")
async def save_output(body: SaveOutputBody, request: Request):
    require_login(request); output_id = secrets.token_urlsafe(12); now = date.today().isoformat()
    with db_connect() as db: db.execute("INSERT INTO saved_outputs(id,kind,title,content,updated_at) VALUES(?,?,?,?,?)", (output_id, body.kind, body.title, body.content, now))
    return {"ok": True, "id": output_id}

@app.get("/api/outputs")
async def list_outputs(request: Request):
    require_login(request)
    with db_connect() as db: rows = db.execute("SELECT id,kind,title,content,updated_at FROM saved_outputs ORDER BY updated_at DESC").fetchall()
    return {"items": [dict(row) for row in rows]}

@app.delete("/api/outputs/{output_id}")
async def delete_output(output_id: str, request: Request):
    require_login(request)
    with db_connect() as db: db.execute("DELETE FROM saved_outputs WHERE id=?", (output_id,))
    return {"ok": True}

@app.post("/api/ai/qa")
async def ask_question(body: QABody, request: Request):
    require_login(request)
    prompt = f"Eres un asistente de investigación empresarial. Responde en {'español' if body.language=='es' else 'English' if body.language=='en' else 'português'}. No inventes ni afirmes que verificaste fuentes si no lo hiciste. Distingue hechos del texto, inferencias y puntos pendientes. Si la respuesta depende de normas, convocatorias o fechas actuales y no hay fuente incluida, dilo y recomienda comprobar la fuente oficial.\n\nPERFIL Y CONTEXTO DISPONIBLE:\n{body.context or 'No se proporcionó contexto.'}\n\nPREGUNTA:\n{body.question}"
    answer, provider = await _run_ai_prompt(prompt)
    return {"ok": True, "answer": answer, "provider": provider}

async def _run_ai_prompt(prompt: str):
    errors=[]
    if os.getenv("GEMINI_API_KEY", "").strip():
        try: return await call_gemini(prompt), "Gemini"
        except Exception: errors.append("Gemini no pudo completar la tarea.")
    if os.getenv("OPENAI_API_KEY", "").strip():
        try: return await call_openai(prompt), "OpenAI"
        except Exception: errors.append("OpenAI no pudo completar la tarea.")
    raise HTTPException(status_code=503, detail="No se pudo completar la tarea. " + " ".join(errors) + " Revisa las claves de IA en Render.")

@app.post("/api/pdf/extract")
async def extract_pdf(body: PDFBody, request: Request):
    require_login(request)
    try:
        raw = base64.b64decode(body.data_base64, validate=True)
    except (binascii.Error, ValueError): raise HTTPException(400, "El archivo PDF no tiene un formato válido.")
    if len(raw) > 12_000_000: raise HTTPException(413, "El PDF supera el tamaño máximo de 12 MB.")
    if not raw.startswith(b"%PDF-"): raise HTTPException(400, "El archivo enviado no parece ser un PDF válido.")
    try:
        from pypdf import PdfReader
    except ImportError: raise HTTPException(503, "La lectura de PDF requiere instalar pypdf en las dependencias de la aplicación.")
    try:
        import io
        reader = PdfReader(io.BytesIO(raw), strict=False)
        pages=[]
        for index, page in enumerate(reader.pages[:150]):
            page_text = (page.extract_text() or "").strip()
            if page_text: pages.append(f"[Página {index+1}]\n{page_text}")
        extracted = "\n\n".join(pages)
    except Exception: raise HTTPException(422, "No se pudo leer el PDF. Comprueba que no esté dañado o protegido con contraseña.")
    if not extracted: raise HTTPException(422, "El PDF no contiene texto seleccionable legible. Esta función no hace OCR de documentos escaneados.")
    if len(extracted) > MAX_TEXT_CHARS: extracted = extracted[:MAX_TEXT_CHARS] + "\n[Texto recortado por el límite de procesamiento.]"
    prompt = f"Analiza el siguiente texto extraído de un PDF. Objetivo del usuario: {body.goal}. Idioma de respuesta: {body.language}. Extrae y organiza hechos, nombres, fechas, importes, requisitos, obligaciones, documentos, riesgos y próximos pasos. No inventes. Señala datos ambiguos y cita los números de página cuando el texto indique página.\n\nTEXTO EXTRAÍDO:\n{extracted}"
    answer, provider = await _run_ai_prompt(prompt)
    return {"ok": True, "filename": body.filename, "pages_read": len(reader.pages), "characters_extracted": len(extracted), "extracted_text": extracted, "answer": answer, "provider": provider, "notice": "Solo se extrajo texto seleccionable; no se aplicó OCR a páginas escaneadas."}

@app.post("/api/data/clear")
async def clear_all_data(body: ClearBody, request: Request):
    require_login(request)
    if body.confirmation != "BORRAR": raise HTTPException(400, "La confirmación no coincide.")
    with db_connect() as db:
        for table in ("projects", "contacts", "work_items", "intake_parts", "saved_outputs"):
            db.execute(f"DELETE FROM {table}")
    return {"ok": True, "message": "Se borraron los contactos, proyectos, tareas, partes temporales y resultados guardados en el servidor. El perfil local se borra por separado en el navegador."}

@app.get("/api/naics/source")
async def naics_source(request: Request):
    require_login(request)
    return {"name": "U.S. Census Bureau — NAICS", "url": "https://www.census.gov/naics/", "search_url": "https://www.census.gov/naics/", "notice": "Los códigos candidatos de IA son sugerencias. Confirma el código y su descripción en el sitio oficial antes de usarlos en una solicitud."}


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
