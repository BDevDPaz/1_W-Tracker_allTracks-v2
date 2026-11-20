import { formatCurrency, formatHours, isToday } from "./formatters";

describe("Formatters Utils", () => {
  describe("formatCurrency", () => {
    it("debe formatear números a formato de dólares", () => {
      expect(formatCurrency(1500.5)).toBe("$1,500.50");
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("maneja valores nulos o indefinidos según la implementación actual", () => {
      // CORRECCIÓN: Usamos @ts-expect-error en lugar de @ts-ignore
      // @ts-expect-error - Forzamos el valor para verificar el comportamiento con NaN
      expect(formatCurrency(undefined)).toBe("$NaN");
    });
  });

  describe("formatHours", () => {
    it("debe convertir horas decimales al formato implementado", () => {
      expect(formatHours(1.5)).toBe("1.5 h");
      expect(formatHours(2)).toBe("2.0 h");
    });
  });

  describe("isToday", () => {
    it("debe retornar true si la fecha es hoy", () => {
      const todayString = new Date().toISOString().split("T")[0];
      expect(isToday(todayString)).toBe(true);
    });

    it("debe retornar false si la fecha es de otro día", () => {
      expect(isToday("2020-01-01")).toBe(false);
    });
  });
});
