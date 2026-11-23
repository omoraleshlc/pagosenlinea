"use client";

import {
  ChangeEvent,
  FocusEventHandler,
  MouseEventHandler,
  forwardRef,
} from "react";
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

/** Mexico dd/mm/yyyy slash mask while typing. */
export function formatearFechaMx(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

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

type MaskedInputProps = {
  /** Controlled masked string from parent (partial typing allowed). */
  displayValue: string;
  onMaskedChange: (value: string) => void;
  /** Injected by react-datepicker — ignored for value; used for calendar open. */
  value?: string;
  onClick?: MouseEventHandler<HTMLInputElement>;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
  placeholder?: string;
};

/**
 * Keeps slash masking (15 → 15/ → 15/03/1988) while DatePicker owns the calendar icon.
 */
const MaskedDateInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  function MaskedDateInput(
    {
      displayValue,
      onMaskedChange,
      value: _datepickerValue,
      onClick,
      onChange: _datepickerOnChange,
      onFocus,
      onBlur,
      className,
      id,
      "aria-describedby": ariaDescribedBy,
      placeholder = "dd/mm/aaaa",
    },
    ref,
  ) {
    return (
      <input
        ref={ref}
        id={id}
        className={className}
        value={displayValue}
        inputMode="numeric"
        autoComplete="bday"
        placeholder={placeholder}
        maxLength={10}
        aria-describedby={ariaDescribedBy}
        onClick={onClick}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => {
          const masked = formatearFechaMx(e.target.value);
          onMaskedChange(masked);
        }}
      />
    );
  },
);

/** Calendar picker + dd/mm/yyyy typing mask together. */
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
        preventOpenOnFocus
        shouldCloseOnSelect
        calendarClassName="fecha-picker-calendar"
        isClearable
        customInput={
          <MaskedDateInput
            id={id}
            className="fecha-picker-input"
            displayValue={value}
            onMaskedChange={onChange}
            aria-describedby={ariaDescribedBy}
          />
        }
      />
    </div>
  );
}
