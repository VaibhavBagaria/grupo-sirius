(function () {
  "use strict";

  /**
   * Configuração do Pix da Sirius ONG.
   * Substitua os valores comentados pela chave da organização.
   */
  const PIX_CONFIG = {
    // Cole aqui a chave Pix que receberá as doações.
    // Pode ser CPF, CNPJ, e-mail, celular (ex.: +5519999999999) ou chave aleatória.
    key: "SUA_CHAVE_PIX_AQUI",

    // Nome do recebedor no QR (máx. 25 caracteres, sem acentos se o banco reclamar)
    merchantName: "SIRIUS ONG",

    // Cidade do recebedor (máx. 15 caracteres)
    merchantCity: "CAMPINAS",
  };

  function tlv(id, value) {
    const len = String(value.length).padStart(2, "0");
    return id + len + value;
  }

  function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
        else crc <<= 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function sanitizeText(value, max) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 .,\-_/]/g, "")
      .trim()
      .slice(0, max);
  }

  function formatAmount(value) {
    return Number(value).toFixed(2);
  }

  function buildPixPayload({ amount, description }) {
    const key = String(PIX_CONFIG.key || "").trim();
    const name = sanitizeText(PIX_CONFIG.merchantName, 25) || "SIRIUS ONG";
    const city = sanitizeText(PIX_CONFIG.merchantCity, 15) || "CAMPINAS";
    const desc = sanitizeText(description, 25);

    const gui = tlv("00", "br.gov.bcb.pix");
    const pixKey = tlv("01", key);
    const pixDesc = desc ? tlv("02", desc) : "";
    const merchantAccount = tlv("26", gui + pixKey + pixDesc);

    const txid = tlv("05", "***");
    const additionalData = tlv("62", txid);

    let payload =
      tlv("00", "01") +
      tlv("01", "12") +
      merchantAccount +
      tlv("52", "0000") +
      tlv("53", "986") +
      tlv("54", formatAmount(amount)) +
      tlv("58", "BR") +
      tlv("59", name) +
      tlv("60", city) +
      additionalData +
      "6304";

    return payload + crc16(payload);
  }

  function isPixConfigured() {
    const key = String(PIX_CONFIG.key || "").trim();
    return key.length > 0 && key !== "SUA_CHAVE_PIX_AQUI";
  }

  function parseAmount(raw) {
    if (raw == null) return NaN;
    const normalized = String(raw).trim().replace(/\s/g, "").replace(",", ".");
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount <= 0) return NaN;
    return Math.round(amount * 100) / 100;
  }

  function formatBRL(amount) {
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (ok) resolve();
      else reject(new Error("copy failed"));
    });
  }

  function flashCopied(button) {
    const original = button.textContent;
    button.textContent = "Copiado!";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-copied");
    }, 1600);
  }

  const modal = document.getElementById("donate-modal");
  if (!modal) return;

  const openers = document.querySelectorAll("[data-donate-open]");
  const closers = modal.querySelectorAll("[data-donate-close]");
  const form = modal.querySelector("#donate-form");
  const customInput = modal.querySelector("#donate-custom-amount");
  const nameInput = modal.querySelector("#donate-name");
  const noteInput = modal.querySelector("#donate-note");
  const result = modal.querySelector("#donate-result");
  const qrHost = modal.querySelector("#donate-qr");
  const payloadField = modal.querySelector("#donate-payload");
  const amountLabel = modal.querySelector("#donate-amount-label");
  const keyHint = modal.querySelector("#donate-key-hint");
  const configWarning = modal.querySelector("#donate-config-warning");
  const copyPayloadBtn = modal.querySelector("#donate-copy-payload");
  const copyKeyBtn = modal.querySelector("#donate-copy-key");
  const resetBtn = modal.querySelector("#donate-reset");

  let lastPayload = "";
  let qrInstance = null;

  function closeNav() {
    const links = document.querySelector(".nav__links");
    const toggle = document.querySelector(".nav__toggle");
    if (links) links.classList.remove("nav__links--open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  function openModal() {
    closeNav();
    modal.hidden = false;
    document.body.classList.add("donate-open");
    modal.querySelector(".donate-modal__dialog").focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("donate-open");
  }

  function selectedPreset() {
    const checked = form.querySelector("input[name='donate-amount']:checked");
    return checked ? checked.value : "custom";
  }

  function currentAmount() {
    const preset = selectedPreset();
    if (preset === "custom") return parseAmount(customInput.value);
    return parseAmount(preset);
  }

  function syncCustomState() {
    const isCustom = selectedPreset() === "custom";
    customInput.disabled = !isCustom;
    if (isCustom) customInput.focus();
  }

  function renderQr(payload) {
    qrHost.innerHTML = "";
    if (typeof QRCode === "undefined") {
      qrHost.textContent = "Não foi possível carregar o QR Code. Use o Pix copia e cola.";
      return;
    }
    qrInstance = new QRCode(qrHost, {
      text: payload,
      width: 196,
      height: 196,
      colorDark: "#0a1628",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  function showResult(amount) {
    if (!isPixConfigured()) {
      configWarning.hidden = false;
      result.hidden = true;
      return;
    }

    configWarning.hidden = true;
    const donor = (nameInput.value || "").trim();
    const note = (noteInput.value || "").trim();
    const description = sanitizeText(donor || note || "Doacao Sirius", 25);
    lastPayload = buildPixPayload({ amount, description });

    amountLabel.textContent = formatBRL(amount);
    payloadField.value = lastPayload;
    keyHint.textContent = PIX_CONFIG.key;
    result.hidden = false;
    renderQr(lastPayload);
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  openers.forEach((btn) => {
    btn.addEventListener("click", openModal);
  });

  closers.forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  form.addEventListener("change", (event) => {
    if (event.target.name === "donate-amount") syncCustomState();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = currentAmount();
    const error = form.querySelector(".donate-form__error");
    if (!Number.isFinite(amount)) {
      error.hidden = false;
      error.textContent = "Digite um valor válido maior que zero.";
      return;
    }
    error.hidden = true;
    showResult(amount);
  });

  copyPayloadBtn.addEventListener("click", () => {
    if (!lastPayload) return;
    copyText(lastPayload).then(() => flashCopied(copyPayloadBtn));
  });

  copyKeyBtn.addEventListener("click", () => {
    if (!isPixConfigured()) return;
    copyText(PIX_CONFIG.key).then(() => flashCopied(copyKeyBtn));
  });

  resetBtn.addEventListener("click", () => {
    result.hidden = true;
    lastPayload = "";
    qrHost.innerHTML = "";
    form.querySelector("#donate-amount-25").checked = true;
    customInput.value = "";
    syncCustomState();
  });

  syncCustomState();
})();
