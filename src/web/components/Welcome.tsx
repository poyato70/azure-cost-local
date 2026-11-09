import { useEffect, useRef, useState } from "react";
export function Welcome() {
  const [open, setOpen] = useState(
    () => !localStorage.getItem("tesseract-welcome-hidden"),
  );
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <>
      <button className="about-button" onClick={() => setOpen(true)}>
        Sobre e créditos
      </button>
      <dialog
        ref={ref}
        onCancel={() => setOpen(false)}
        className="welcome-dialog"
      >
        {open && <iframe title="Tesseract 4D interativo" src="/tesseract-4d.html" sandbox="allow-scripts" className="tesseract-frame"/>}
        <h2>Bem-vindo ao TESSERACT</h2>
        <p>Conexões, evidências e decisões para o time FinOps.</p>
        <p>
          Projeto: Everton Poyato · FinOps & IA
          <br />
          Símbolo de referência fornecido pelo usuário.
          <br />
          Sem endosso oficial dos provedores.
        </p>
        <label className="consent">
          <input
            type="checkbox"
            onChange={(e) =>
              e.target.checked
                ? localStorage.setItem("tesseract-welcome-hidden", "1")
                : localStorage.removeItem("tesseract-welcome-hidden")
            }
          />
          Não mostrar na próxima abertura
        </label>
        <button autoFocus className="primary" onClick={() => setOpen(false)}>
          OK, começar
        </button>
      </dialog>
    </>
  );
}
