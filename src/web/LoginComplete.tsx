import { Brand } from "./components/Brand.js";
import { useEffect, useState } from "react";
import { api } from "./api.js";
export function LoginComplete() {
  const [message, setMessage] = useState("Concluindo login…");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    api
      .bootstrap()
      .then((b) => {
        if (!active) return;
        setMessage(
          b.authenticated
            ? "Login concluído. O dashboard será atualizado automaticamente."
            : b.loginError?.message ||
                "Login não concluído. Volte ao dashboard e inicie novamente.",
        );
        timer = setTimeout(() => window.close(), 1600);
      })
      .catch(() => {
        if (active)
          setMessage("Volte ao dashboard para verificar o resultado do login.");
      });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return (
    <main className="login-complete">
      <Brand />
      <h1>Login Microsoft</h1>
      <p role="status">{message}</p>
      <button className="primary" onClick={() => window.close()}>
        Fechar janela
      </button>
      <p>
        <a href="/">Voltar ao dashboard</a>
      </p>
    </main>
  );
}
