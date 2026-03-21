import { useMemo, useState } from "react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

const DAYS = [
  { key: "sunday", label: "ראשון" },
  { key: "monday", label: "שני" },
  { key: "tuesday", label: "שלישי" },
  { key: "wednesday", label: "רביעי" },
  { key: "thursday", label: "חמישי" },
  { key: "friday", label: "שישי" },
  { key: "saturday", label: "שבת" }
];

const emptyAvailability = { day: "sunday", start: "10:00", end: "16:00" };
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const SCHEDULE_FETCH_TIMEOUT_MS = 90_000;
const MAX_EMPLOYEE_NAME_LEN = 200;

function toMinutes(timeValue) {
  const [hh, mm] = timeValue.split(":").map(Number);
  return hh * 60 + mm;
}

function createEmployee(id) {
  return {
    id: String(id),
    name: "",
    isManager: false,
    preferredForMoreShifts: false,
    availability: [{ ...emptyAvailability }]
  };
}

export default function App() {
  const [employees, setEmployees] = useState([createEmployee(1)]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const employeesById = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const updateEmployee = (id, updater) => {
    setEmployees((prev) => prev.map((emp) => (emp.id === id ? updater(emp) : emp)));
  };

  const clearApiError = () => setApiError("");

  const addEmployee = () => {
    clearApiError();
    setEmployees((prev) => [...prev, createEmployee(Date.now())]);
  };

  const removeEmployee = (id) => {
    clearApiError();
    setSchedule(null);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const addAvailability = (employeeId) => {
    updateEmployee(employeeId, (emp) => ({
      ...emp,
      availability: [...emp.availability, { ...emptyAvailability }]
    }));
  };

  const removeAvailability = (employeeId, index) => {
    updateEmployee(employeeId, (emp) => ({
      ...emp,
      availability: emp.availability.filter((_, i) => i !== index)
    }));
  };

  const updateAvailability = (employeeId, index, patch) => {
    updateEmployee(employeeId, (emp) => ({
      ...emp,
      availability: emp.availability.map((a, i) => (i === index ? { ...a, ...patch } : a))
    }));
  };

  const generateSchedule = async () => {
    setApiError("");
    setSchedule(null);

    if (employees.length === 0) {
      setApiError("אין עובדים ברשימה. לחץ על + הוסף עובד.");
      return;
    }

    const unnamedRowNumbers = employees
      .map((e, i) => (!String(e.name || "").trim() ? i + 1 : null))
      .filter((n) => n != null);
    if (unnamedRowNumbers.length > 0) {
      setApiError(
        `יש למלא שם לכל העובדים (חסר שם בעובדים מס׳ ${unnamedRowNumbers.join(", ")}). אפשר למחוק שורה מיותרת עם ×.`
      );
      return;
    }

    const normalizedEmployees = employees.map((e) => ({
      ...e,
      name: e.name.trim(),
      availability: (e.availability || []).filter((a) => a.day && a.start && a.end)
    }));

    const employeeMissingAvailability = normalizedEmployees.find((e) => e.availability.length === 0);
    if (employeeMissingAvailability) {
      setApiError(`לעובד ${employeeMissingAvailability.name} אין זמינות תקינה (הוסף טווח שעות או מחק שורת זמינות ריקה).`);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCHEDULE_FETCH_TIMEOUT_MS);
    try {
      const payload = { employees: normalizedEmployees };
      const res = await fetch(`${API_BASE}/api/schedule/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const raw = await res.text();
      let data = null;
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            res.ok
              ? "תגובת השרת לא בפורמט תקין."
              : `השרת החזיר תשובה לא צפויה (${res.status}). בדוק את כתובת ה-API ושהשרת רץ.`
          );
        }
      } else if (!res.ok) {
        throw new Error(
          `השרת החזיר תשובה ריקה (${res.status}). בדוק את כתובת ה-API ושהשרת רץ.`
        );
      }

      if (!res.ok) {
        const detailsText = Array.isArray(data?.details)
          ? data.details.map((d) => `${d.path?.join(".") || "field"}: ${d.message}`).join(" | ")
          : "";
        const msg = [data?.message, data?.error, detailsText].filter(Boolean).join(" — ") || "הבקשה נדחתה.";
        throw new Error(msg);
      }
      if (!data || typeof data !== "object") {
        throw new Error("תגובת השרת חסרה או לא תקינה.");
      }
      setSchedule(data);
    } catch (err) {
      if (err?.name === "AbortError") {
        setApiError("פג הזמן — השרת לא הגיב. בדוק חיבור ושהשרת רץ.");
      } else if (err?.message === "Failed to fetch" || err?.name === "TypeError") {
        setApiError("לא ניתן להתחבר לשרת. בדוק שכתובת ה-API נכונה ושהשרת הופעל.");
      } else {
        setApiError(err?.message || "הייתה שגיאה ביצירת הסידור.");
      }
      console.error(err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const manuallyAssign = (slotId, employeeId) => {
    if (!schedule) return;
    const targetSlot = schedule.shifts.find((s) => s.slotId === slotId);
    if (!targetSlot) return;
    const employee = employeesById.get(employeeId);
    setSchedule((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) =>
        s.slotId === slotId
          ? {
              ...s,
              employeeId: employeeId || null,
              employeeName: employeeId ? employee?.name ?? "לא הוגדר" : null,
              isManagerAssigned: !!employee?.isManager
            }
          : employeeId && s.day === targetSlot.day && s.employeeId === employeeId
            ? {
                ...s,
                employeeId: null,
                employeeName: null,
                isManagerAssigned: false
              }
          : s
      )
    }));
  };

  const scheduleGrid = useMemo(() => {
    if (!schedule) return null;
    const byDay = Object.fromEntries(DAYS.map((d) => [d.key, []]));
    for (const shift of schedule.shifts) {
      byDay[shift.day].push(shift);
    }
    for (const dayKey of Object.keys(byDay)) {
      byDay[dayKey].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    }
    const maxRows = Math.max(...Object.values(byDay).map((arr) => arr.length));
    return { byDay, maxRows };
  }, [schedule]);

  const slotCandidatesById = useMemo(() => {
    if (!schedule) return new Map();
    const map = new Map();
    for (const s of schedule.shifts) {
      map.set(s.slotId, s.availableCandidates || []);
    }
    return map;
  }, [schedule]);

  /** Weekly grid for export: rows of 7 cells (one per day). Each cell: { name, hours, isManager } or null. */
  const getWeeklyExportGrid = useMemo(() => {
    if (!schedule || !scheduleGrid) return null;
    const { byDay, maxRows } = scheduleGrid;
    const headerRow = DAYS.map((d) => d.label);
    const rows = [];
    for (let r = 0; r < maxRows; r++) {
      const row = [];
      for (const day of DAYS) {
        const shift = byDay[day.key]?.[r];
        if (!shift) {
          row.push(null);
          continue;
        }
        row.push({
          name: shift.employeeName ?? "—",
          hours: `${shift.start}-${shift.end}`,
          isManager: !!shift.isManagerAssigned
        });
      }
      rows.push(row);
    }
    return { headerRow, rows };
  }, [schedule, scheduleGrid]);

  const exportExcel = async () => {
    const grid = getWeeklyExportGrid;
    if (!grid || grid.rows.length === 0) return;
    const ExcelJS = (await import("exceljs/dist/exceljs.min.js")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("תכנון שבועי", { views: [{ rightToLeft: true }] });
    const managerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAD3" } }; // ירוק בהיר לאחמ״ש
    ws.addRow(grid.headerRow);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    for (let c = 1; c <= 7; c++) ws.getColumn(c).width = 14;
    grid.rows.forEach((row) => {
      const excelRow = ws.addRow(
        row.map((cell) => (cell ? `${cell.name}\n${cell.hours}` : ""))
      );
      row.forEach((cell, colIdx) => {
        if (!cell) return;
        const excelCell = excelRow.getCell(colIdx + 1);
        excelCell.alignment = { vertical: "middle", wrapText: true };
        if (cell.isManager) excelCell.fill = managerFill;
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "work-schedule.xlsx");
  };

  const exportWord = async () => {
    const grid = getWeeklyExportGrid;
    if (!grid || grid.rows.length === 0) return;

    const managerShading = { fill: "D9EAD3" }; // ירוק בהיר לאחמ״ש
    const tableRows = [
      new TableRow({
        children: grid.headerRow.map((label) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })]
          })
        )
      }),
      ...grid.rows.map((row) =>
        new TableRow({
          children: row.map((cell) => {
            const name = cell ? cell.name : "—";
            const hours = cell ? cell.hours : "";
            const cellContent = [
              new Paragraph({ children: [new TextRun(name)] }),
              new Paragraph({ children: [new TextRun(hours)] })
            ];
            return new TableCell({
              children: cellContent,
              shading: cell?.isManager ? managerShading : undefined
            });
          })
        })
      )
    ];

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: "תכנון שבועי - סידור עבודה גלידרייה", bold: true })]
            }),
            new Paragraph(""),
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            })
          ]
        }
      ]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "work-schedule.docx");
  };

  return (
    <div className="page">
      <h1>מערכת סידור עבודה - GOLDA PETAH TIKVA</h1>

      <section className="card">
        <h2>עובדים וזמינויות</h2>
        <form
          className="schedule-form"
          onSubmit={(e) => {
            e.preventDefault();
            generateSchedule();
          }}
        >
          <button type="button" onClick={addEmployee}>
            + הוסף עובד
          </button>
          <div className="employees">
            {employees.length === 0 ? (
              <p className="empty-hint">אין עובדים — לחץ + הוסף עובד.</p>
            ) : (
              employees.map((employee, empIndex) => (
                <div key={employee.id} className="employee-box">
                  <div className="employee-box-header">
                    <span className="employee-box-title">עובד {empIndex + 1}</span>
                    <button
                      type="button"
                      className="btn-remove-employee"
                      onClick={() => removeEmployee(employee.id)}
                      title="הסר עובד"
                      aria-label={`הסר את עובד ${empIndex + 1}`}
                    >
                      ×
                    </button>
                  </div>
                  <input
                    placeholder="שם עובד (חובה)"
                    autoComplete="name"
                    value={employee.name}
                    maxLength={MAX_EMPLOYEE_NAME_LEN}
                    onChange={(e) => {
                      clearApiError();
                      updateEmployee(employee.id, (emp) => ({ ...emp, name: e.target.value }));
                    }}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={employee.isManager}
                      onChange={(e) =>
                        updateEmployee(employee.id, (emp) => ({
                          ...emp,
                          isManager: e.target.checked
                        }))
                      }
                    />
                    אחמ״ש
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={employee.preferredForMoreShifts}
                      onChange={(e) =>
                        updateEmployee(employee.id, (emp) => ({
                          ...emp,
                          preferredForMoreShifts: e.target.checked
                        }))
                      }
                    />
                    עדיפות ליותר משמרות
                  </label>

                  {employee.availability.map((a, idx) => (
                    <div className="availability-row" key={`${employee.id}-${idx}`}>
                      <select
                        value={a.day}
                        onChange={(e) => updateAvailability(employee.id, idx, { day: e.target.value })}
                      >
                        {DAYS.map((day) => (
                          <option key={day.key} value={day.key}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={a.start}
                        onChange={(e) => updateAvailability(employee.id, idx, { start: e.target.value })}
                      />
                      <input
                        type="time"
                        value={a.end}
                        onChange={(e) => updateAvailability(employee.id, idx, { end: e.target.value })}
                      />
                      <button type="button" onClick={() => removeAvailability(employee.id, idx)}>
                        מחק
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addAvailability(employee.id)}>
                    + זמינות
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? "מייצר..." : "צור סידור"}
            </button>
          </div>
          {apiError ? (
            <p className="error" role="alert">
              {apiError}
            </p>
          ) : null}
        </form>
      </section>

      {schedule ? (
        <section className="card">
          <h2>תוצאות סידור</h2>
          <div className="export-actions">
            <button type="button" onClick={exportExcel}>
              ייצוא ל-Excel
            </button>
            <button type="button" onClick={exportWord}>
              ייצוא ל-Word
            </button>
          </div>
          {schedule.warnings?.length ? (
            <div className="warn-box">
              {schedule.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          ) : null}
          <table>
            <thead>
              <tr>
                {DAYS.map((d) => (
                  <th key={d.key}>{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: scheduleGrid?.maxRows || 0 }).map((_, rowIdx) => (
                <tr key={`row-${rowIdx}`}>
                  {DAYS.map((day) => {
                    const s = scheduleGrid?.byDay[day.key]?.[rowIdx];
                    if (!s) return <td key={`${day.key}-${rowIdx}`} className="empty-cell">-</td>;
                    const relevantCandidates = slotCandidatesById.get(s.slotId) || [];
                    return (
                      <td key={s.slotId} className={!s.employeeId ? "unassigned-cell" : ""}>
                        <div className="shift-cell">
                          <div>{s.start}-{s.end}</div>
                          <div>{s.preferManager ? "מעדיף אחמ״ש" : "רגיל"}</div>
                          <div>{s.employeeName ?? "לא שובץ"}</div>
                          <select value={s.employeeId ?? ""} onChange={(e) => manuallyAssign(s.slotId, e.target.value)}>
                            <option value="">ללא</option>
                            {relevantCandidates.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name || "ללא שם"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <h3>סטטיסטיקה</h3>
          <ul>
            {schedule.employeeStats.map((stat) => (
              <li key={stat.id}>
                {stat.name}: שובץ {stat.assignedCount} מתוך {stat.availabilityCount} אופציות
                {" | "}
                יחס קבלה: {Math.round((stat.assignmentRatio || 0) * 100)}%
                {" | "}
                יעד יחסי: ~{stat.targetShare ? stat.targetShare.toFixed(1) : "0.0"} משמרות
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
