import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ContextMenu from "@/components/media-library/ContextMenu";

const items = [
  { label: "Renommer", onClick: jest.fn() },
  { label: "Supprimer", onClick: jest.fn(), variant: "danger" as const },
];
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ContextMenu", () => {
  it("rend les items du menu", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    expect(screen.getByText("Renommer")).toBeInTheDocument();
    expect(screen.getByText("Supprimer")).toBeInTheDocument();
  });

  it("positionné en fixed aux coordonnées fournies", () => {
    const { container } = render(
      <ContextMenu x={100} y={200} items={items} onClose={onClose} />
    );
    const menu = container.firstChild as HTMLElement;
    expect(menu).toHaveStyle({ top: "200px", left: "100px" });
  });

  it("clic sur un item appelle onClick de l'item", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    fireEvent.click(screen.getByText("Renommer"));
    expect(items[0].onClick).toHaveBeenCalled();
  });

  it("clic sur item danger appelle onClick", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    fireEvent.click(screen.getByText("Supprimer"));
    expect(items[1].onClick).toHaveBeenCalled();
  });

  it("mousedown en dehors du menu appelle onClose", () => {
    render(
      <div>
        <ContextMenu x={100} y={200} items={items} onClose={onClose} />
        <div data-testid="outside">Extérieur</div>
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalled();
  });

  it("mousedown à l'intérieur du menu n'appelle pas onClose", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByText("Renommer"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("touche Escape appelle onClose", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("autres touches ne ferment pas le menu", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("item variant danger reçoit la classe text-red-400", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    const btn = screen.getByText("Supprimer");
    expect(btn).toHaveClass("text-red-400");
  });

  it("item sans variant reçoit la classe text-fore", () => {
    render(<ContextMenu x={100} y={200} items={items} onClose={onClose} />);
    const btn = screen.getByText("Renommer");
    expect(btn).toHaveClass("text-fore");
  });
});
