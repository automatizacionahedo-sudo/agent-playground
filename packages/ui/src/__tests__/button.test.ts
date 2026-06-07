import { describe, it, expect } from "vitest";
import { Button, ButtonProps } from "../index";

describe("Button", () => {
  it("should return a button object with the correct type", () => {
    const result = Button({ label: "Click me" });
    expect(result).toEqual({
      type: "button",
      label: "Click me",
      disabled: false,
    });
  });

  it("should set disabled to false by default", () => {
    const result = Button({ label: "Submit" });
    expect(result.disabled).toBe(false);
  });

  it("should accept and apply the disabled prop", () => {
    const result = Button({ label: "Save", disabled: true });
    expect(result.disabled).toBe(true);
  });

  it("should return false when disabled is explicitly set to false", () => {
    const result = Button({ label: "Cancel", disabled: false });
    expect(result.disabled).toBe(false);
  });

  it("should preserve the label string", () => {
    const label = "Delete";
    const result = Button({ label });
    expect(result.label).toBe(label);
  });

  it("should accept an empty string as label", () => {
    const result = Button({ label: "" });
    expect(result.label).toBe("");
  });

  it("should return type 'button'", () => {
    const result = Button({ label: "test" });
    expect(result.type).toBe("button");
  });

  it("should handle all props passed simultaneously", () => {
    const result = Button({ label: "Confirm", disabled: true });
    expect(result).toEqual({
      type: "button",
      label: "Confirm",
      disabled: true,
    });
  });
});
