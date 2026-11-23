"use client";

import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("es", es);

type FechaNacimientoPickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  "aria-describedby"?: string;
};

function parseFechaMx(value: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

function toFechaMx(date: Date | null): string {
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Birth-date picker: calendar + month/year dropdowns, Mexico dd/mm/yyyy. */
export function FechaNacimientoPicker({
  value,
  onChange,
  id,
  "aria-describedby": ariaDescribedBy,
}: FechaNacimientoPickerProps) {
  const selected = parseFechaMx(value);
  const maxDate = new Date();
  const minDate = new Date(1900, 0, 1);

  return (
    <div className="fecha-picker-wrap">
      <DatePicker
        id={id}
        locale="es"
        selected={selected}
        onChange={(date: Date | null) => onChange(toFechaMx(date))}
        dateFormat="dd/MM/yyyy"
        placeholderText="dd/mm/aaaa"
        maxDate={maxDate}
        minDate={minDate}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        yearDropdownItemNumber={100}
        scrollableYearDropdown
        showIcon
        toggleCalendarOnIconClick
        autoComplete="bday"
        className="fecha-picker-input"
        calendarClassName="fecha-picker-calendar"
        ariaDescribedBy={ariaDescribedBy}
        isClearable
        strictParsing
      />
    </div>
  );
}
