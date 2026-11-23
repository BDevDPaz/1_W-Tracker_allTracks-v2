import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { IPDFService, PDFReport, Session } from "@/types/contracts";
import { formatCurrency, formatHours } from "@/utils";

type TimelineEventUI = {
  time: string;
  type: "SYSTEM" | "WORK" | "TRANSFER" | "LUNCH";
  label: string;
  relativeMinutes: number;
};

class PDFServiceImpl implements IPDFService {
  async generate(report: PDFReport): Promise<string> {
    try {
      const html = this._buildReportHTML(report);
      const fileResult = await Print.printToFileAsync({ html });
      return fileResult.uri;
    } catch (error) {
      console.error("[PDFService generate Failed]", error);
      throw error;
    }
  }

  async share(filePath: string): Promise<void> {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error(
        "La función de compartir no está disponible en este dispositivo.",
      );
    }
    await Sharing.shareAsync(filePath, {
      mimeType: "application/pdf",
      dialogTitle: "Exportar Auditoría de Jornada W-Tracker",
      UTI: "com.adobe.pdf",
    });
  }

  async sendByEmail(filePath: string, to: string): Promise<void> {
    const canSendEmail = await MailComposer.isAvailableAsync();
    if (!canSendEmail) {
      throw new Error(
        "El cliente de correo electrónico no está configurado o disponible.",
      );
    }
    await MailComposer.composeAsync({
      recipients: to ? [to.trim()] : [],
      subject: "Auditoría de Jornada Laboral — W-Tracker",
      body: "Adjunto se encuentra el documento forense y de nómina de mis jornadas de trabajo generado automáticamente por W-Tracker.",
      attachments: [filePath],
    });
  }

  async preview(filePath: string): Promise<void> {
    try {
      await Print.printAsync({ uri: filePath });
    } catch (error) {
      console.warn(
        "[PDF Preview Warning] Print preview falló, derivando a menú compartir.",
        error,
      );
      await this.share(filePath);
    }
  }

  private _buildReportHTML(report: PDFReport): string {
    const summary = report.summary;
    const sessions = report.sessions || [];

    let sessionsHtml = "";
    for (const s of sessions) {
      sessionsHtml += this._buildSessionWorkDayBlock(s);
    }

    if (!sessionsHtml) {
      sessionsHtml = `
        <div style="text-align: center; color: #777; padding: 24px; border: 1px dashed #ccc; border-radius: 8px;">
          No hay sesiones registradas para este periodo.
        </div>
      `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Auditoría de Jornada — W-Tracker</title>
  <style>
    body { font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; color: #1a1a1a; background-color: #ffffff; margin: 40px; line-height: 1.5; font-size: 12px; }
    .header-container { border-bottom: 2px solid #C5A059; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 26px; font-weight: 800; color: #C5A059; letter-spacing: -0.5px; }
    .report-title { font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .period-label { font-size: 16px; font-weight: 700; color: #1a1a1a; }
    .meta-box { text-align: right; font-size: 10px; color: #777; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 1px solid #eaeaea; padding-bottom: 5px; margin-top: 25px; margin-bottom: 15px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
    .summary-card { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; text-align: center; }
    .summary-card .label { font-size: 9px; font-weight: 700; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .summary-card .value { font-size: 18px; font-weight: 700; color: #212529; }
    .summary-card .value-gold { color: #b2853c; }
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .summary-table th, .summary-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e9ecef; }
    .summary-table th { background-color: #f8f9fa; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #495057; }
    .workday-block { page-break-inside: avoid; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin-bottom: 20px; background-color: #fff; }
    .workday-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 12px; }
    .workday-date { font-size: 14px; font-weight: 700; color: #212529; }
    .workday-state { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
    .workday-state.valid { background-color: #e6f4ea; color: #1e7e34; }
    .workday-state.manual { background-color: #e2e3e5; color: #383d41; }
    .workday-state.conflict { background-color: #fff3cd; color: #856404; }
    .timeline-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    .timeline-table th { text-align: left; font-size: 9px; font-weight: 700; color: #6c757d; text-transform: uppercase; padding-bottom: 4px; border-bottom: 1px solid #dee2e6; }
    .timeline-table td { padding: 6px 4px; border-bottom: 1px dashed #e9ecef; vertical-align: middle; }
    .timeline-time { font-family: 'Courier New', Courier, monospace; font-weight: 600; color: #495057; width: 60px; }
    .badge { font-size: 9px; padding: 2px 5px; border-radius: 3px; font-weight: 700; text-transform: uppercase; display: inline-block; min-width: 60px; text-align: center; }
    .badge-system { background-color: #343a40; color: #fff; }
    .badge-work { background-color: #e6f4ea; color: #1e7e34; }
    .badge-transfer { background-color: #e8f0fe; color: #1a73e8; }
    .badge-lunch { background-color: #fef7e0; color: #b06000; }
    .notes-box { font-size: 11px; color: #495057; background-color: #f8f9fa; border-left: 3px solid #C5A059; padding: 8px 10px; margin-top: 12px; }
    .footer-note { text-align: center; margin-top: 40px; font-size: 9px; color: #adb5bd; border-top: 1px solid #e9ecef; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <div class="brand">W-TRACKER</div>
      <div class="report-title">Auditoría y Nómina Consolidada V2.0</div>
    </div>
    <div class="meta-box">
      <div class="period-label">${this._escapeHtml(report.periodLabel)}</div>
      <div>Emitido: ${this._formatDateTime(report.generatedAt)}</div>
    </div>
  </div>

  <div class="section-title">Resumen Financiero y de Rendimiento</div>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Horas Totales</div><div class="value">${formatHours(summary.totalHours ?? 0)}</div></div>
    <div class="summary-card"><div class="label">Tiempo Extra</div><div class="value">${formatHours(summary.overtimeHours ?? 0)}</div></div>
    <div class="summary-card"><div class="label">Jornadas</div><div class="value">${summary.sessionCount ?? 0}</div></div>
    <div class="summary-card"><div class="label">Total Estimado</div><div class="value value-gold">${formatCurrency(summary.totalEarnings ?? 0)}</div></div>
  </div>

  <table class="summary-table">
    <thead>
      <tr><th>Concepto</th><th>Horas</th><th>Tarifa Base</th><th>Multiplicador</th><th>Subtotal</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Horas Ordinarias (Base)</td>
        <td>${formatHours(Math.max(0, (summary.totalHours ?? 0) - (summary.overtimeHours ?? 0)))}</td>
        <td>${formatCurrency(summary.baseRate ?? 20)}/h</td>
        <td>—</td>
        <td>${formatCurrency(summary.baseEarnings ?? 0)}</td>
      </tr>
      <tr>
        <td>Horas Extra (Overtime)</td>
        <td>${formatHours(summary.overtimeHours ?? 0)}</td>
        <td>${formatCurrency(summary.baseRate ?? 20)}/h</td>
        <td>x${summary.overtimeMultiplier ?? 1.5}</td>
        <td>${formatCurrency(summary.overtimeEarnings ?? 0)}</td>
      </tr>
      <tr style="font-weight: 700; border-top: 1px solid #dee2e6;">
        <td>Total Consolidado</td>
        <td>${formatHours(summary.totalHours ?? 0)}</td>
        <td colspan="2"></td>
        <td style="color: #b2853c; font-size: 14px;">${formatCurrency(summary.totalEarnings ?? 0)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Bitácora Forense Detallada por Jornada</div>
  ${sessionsHtml}

  <div class="footer-note">
    Este documento constituye evidencia de auditoría de los estados de la jornada laboral.<br>
    Cualquier alteración manual ("MANUAL") o conflicto ("CONFLICT") está debidamente señalizado.<br>
    <strong>W-Tracker — Motor de Trazabilidad Resiliente</strong>
  </div>
</body>
</html>`;
  }

  private _buildSessionWorkDayBlock(session: Session): string {
    const isClosed = session.state === "CERRADA";
    const stateLabel = isClosed ? "Jornada Cerrada" : "En Curso";
    const stateClass =
      session.integrityType === "MANUAL"
        ? "manual"
        : session.integrityType === "CONFLICT"
          ? "conflict"
          : "valid";
    const timelineEvents = this._generateTimeline(session);

    let timelineHtml = "";
    for (const event of timelineEvents) {
      let badgeClass = "";
      let badgeText = "";
      switch (event.type) {
        case "SYSTEM":
          badgeClass = "badge-system";
          badgeText = "SISTEMA";
          break;
        case "WORK":
          badgeClass = "badge-work";
          badgeText = "TRABAJO";
          break;
        case "TRANSFER":
          badgeClass = "badge-transfer";
          badgeText = "TRASLADO";
          break;
        case "LUNCH":
          badgeClass = "badge-lunch";
          badgeText = "ALMUERZO";
          break;
      }
      timelineHtml += `
        <tr>
          <td class="timeline-time">${this._escapeHtml(event.time)}</td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>${this._escapeHtml(event.label)}</td>
        </tr>
      `;
    }

    return `
      <div class="workday-block">
        <div class="workday-header">
          <span class="workday-date">${this._formatDate(session.date)}</span>
          <span class="workday-state ${stateClass}">${this._escapeHtml(stateLabel)} | Integridad: ${this._escapeHtml(session.integrityType)}</span>
        </div>
        <table style="width: 100%; font-size: 10px; margin-bottom: 12px; color: #495057;">
          <tr>
            <td><strong>Horas Totales:</strong> ${formatHours(session.totalHours)}</td>
            <td><strong>Tarifa:</strong> ${formatCurrency(session.snapshotRate)}/h</td>
            <td><strong>Almuerzo Descontado:</strong> ${session.lunchDeductedMinutes} min</td>
            <td style="text-align: right; color: #b2853c; font-size: 11px;"><strong>Ingreso Diario:</strong> ${formatCurrency(session.totalEarnings)}</td>
          </tr>
        </table>
        <table class="timeline-table">
          <thead><tr><th style="width: 60px;">Hora</th><th style="width: 80px;">Estado</th><th>Evento Registrado</th></tr></thead>
          <tbody>${timelineHtml}</tbody>
        </table>
        ${session.notes ? `<div class="notes-box"><strong>Nota del Operario:</strong> ${this._escapeHtml(session.notes)}</div>` : ""}
      </div>
    `;
  }

  private _generateTimeline(session: Session): TimelineEventUI[] {
    const events: TimelineEventUI[] = [];
    const baseTime = session.createdAt || session.startTime;

    if (session.createdAt) {
      events.push({
        time: this._formatTime(session.createdAt),
        type: "SYSTEM",
        label: "Jornada configurada",
        relativeMinutes: 0,
      });
    }

    if (session.startTime) {
      events.push({
        time: this._formatTime(session.startTime),
        type: "WORK",
        label: "Llegada al destino",
        relativeMinutes: this._getRelativeMinutes(baseTime, session.startTime),
      });
    }

    if (session.endTime) {
      events.push({
        time: this._formatTime(session.endTime),
        type: "SYSTEM",
        label: "Cierre de la jornada laboral",
        relativeMinutes: this._getRelativeMinutes(baseTime, session.endTime),
      });
    }

    for (const v of session.visits) {
      const destName = v.alias || v.destination;
      events.push({
        time: this._formatTime(v.enterTime),
        type: "WORK",
        label: `Check-in en destino: ${destName}`,
        relativeMinutes: this._getRelativeMinutes(baseTime, v.enterTime),
      });
      if (v.exitTime) {
        events.push({
          time: this._formatTime(v.exitTime),
          type: "WORK",
          label: `Check-out de destino: ${destName} (Duración: ${this._formatMinutesDiff(v.enterTime, v.exitTime)})`,
          relativeMinutes: this._getRelativeMinutes(baseTime, v.exitTime),
        });
      }
    }

    for (const t of session.transfers) {
      const dest = t.targetDestination || t.destination || "Destino posterior";
      events.push({
        time: this._formatTime(t.startTime),
        type: "TRANSFER",
        label: `Inicia traslado hacia: ${dest}`,
        relativeMinutes: this._getRelativeMinutes(baseTime, t.startTime),
      });
      if (t.endTime) {
        events.push({
          time: this._formatTime(t.endTime),
          type: "TRANSFER",
          label: `Llegada de traslado (Duración: ${this._formatMinutesDiff(t.startTime, t.endTime)})`,
          relativeMinutes: this._getRelativeMinutes(baseTime, t.endTime),
        });
      }
    }

    for (const b of session.breaks) {
      events.push({
        time: this._formatTime(b.startTime),
        type: "LUNCH",
        label: "Inicia pausa de almuerzo",
        relativeMinutes: this._getRelativeMinutes(baseTime, b.startTime),
      });
      if (b.endTime) {
        events.push({
          time: this._formatTime(b.endTime),
          type: "LUNCH",
          label: `Termina pausa de almuerzo (Duración: ${b.durationMinutes ?? this._getRelativeMinutes(b.startTime, b.endTime)} min)`,
          relativeMinutes: this._getRelativeMinutes(baseTime, b.endTime),
        });
      }
    }

    return events.sort((a, b) => a.relativeMinutes - b.relativeMinutes);
  }

  private _getRelativeMinutes(start: string, current: string): number {
    if (!start || !current) return 0;
    const startMs = Date.parse(start);
    const currentMs = Date.parse(current);
    if (!Number.isNaN(startMs) && !Number.isNaN(currentMs)) {
      const diff = Math.round((currentMs - startMs) / 60000);
      return diff < 0 ? 0 : diff;
    }
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = current.split(":").map(Number);
    if (
      h1 === undefined ||
      m1 === undefined ||
      h2 === undefined ||
      m2 === undefined ||
      Number.isNaN(h1) ||
      Number.isNaN(m1) ||
      Number.isNaN(h2) ||
      Number.isNaN(m2)
    )
      return 0;
    let diff = h2 * 60 + m2 - (h1 * 60 + m1);
    if (diff < 0) diff += 1440;
    return diff;
  }

  private _formatTime(value: string): string {
    if (!value) return "--:--";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("es-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (value.includes(":")) return value.slice(0, 5);
    return value;
  }

  private _formatDateTime(value: string): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString("es-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _formatDate(value: string): string {
    if (!value) return "";
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString("es-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private _formatMinutesDiff(start: string, end: string): string {
    const diff = this._getRelativeMinutes(start, end);
    if (!Number.isFinite(diff) || diff < 0) return "0 min";
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  }

  private _escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

export const PDFService = new PDFServiceImpl();
export const pdfService = PDFService;
