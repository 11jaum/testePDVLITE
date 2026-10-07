const express = require("express");
const router = express.Router();
const db = require("../database");

router.get("/resumo", (req, res) => {
    try {
        // Estes cards são indicadores em tempo real.
        // Nunca devem ser servidos pelo cache do WebView/navegador.
        res.set({
            "Cache-Control":
                "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma":
                "no-cache",
            "Expires":
                "0"
        });

        const hojeLocal =
            new Date();

        hojeLocal.setHours(
            0,
            0,
            0,
            0
        );

        const amanhaLocal =
            new Date(
                hojeLocal
            );

        amanhaLocal.setDate(
            amanhaLocal.getDate() + 1
        );

        const ontemLocal =
            new Date(
                hojeLocal
            );

        ontemLocal.setDate(
            ontemLocal.getDate() - 1
        );

        const paraSqlUtc =
            data =>
                data
                    .toISOString()
                    .slice(
                        0,
                        19
                    )
                    .replace(
                        "T",
                        " "
                    );

        const inicioHoje =
            paraSqlUtc(
                hojeLocal
            );

        const inicioAmanha =
            paraSqlUtc(
                amanhaLocal
            );

        const inicioOntem =
            paraSqlUtc(
                ontemLocal
            );

        const resumoVendasPeriodo =
            db.prepare(`
                SELECT
                    COUNT(*) AS quantidade_vendas,
                    COALESCE(
                        SUM(total),
                        0
                    ) AS faturamento
                FROM vendas
                WHERE status = 'finalizada'
                  AND criado_em >= ?
                  AND criado_em < ?
            `);

        const vendasHoje =
            resumoVendasPeriodo.get(
                inicioHoje,
                inicioAmanha
            );

        const vendasOntem =
            resumoVendasPeriodo.get(
                inicioOntem,
                inicioHoje
            );

        const estoque =
            db.prepare(`
                SELECT
                    COUNT(*) AS total_produtos,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN COALESCE(
                                    tipo_estoque,
                                    'normal'
                                ) <> 'fracionado'
                                THEN quantidade
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_itens,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN COALESCE(
                                    tipo_estoque,
                                    'normal'
                                ) <> 'fracionado'
                                 AND quantidade <=
                                     estoque_minimo
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS estoque_baixo,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN COALESCE(
                                    tipo_estoque,
                                    'normal'
                                ) <> 'fracionado'
                                 AND quantidade = 0
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS sem_estoque

                FROM produtos
                WHERE ativo = 1
            `).get();

        return res.json({
            sucesso: true,
            atualizado_em:
                new Date().toISOString(),

            hoje: {
                quantidade_vendas:
                    Number(
                        vendasHoje
                            .quantidade_vendas ||
                        0
                    ),
                faturamento:
                    Number(
                        vendasHoje
                            .faturamento ||
                        0
                    )
            },

            ontem: {
                quantidade_vendas:
                    Number(
                        vendasOntem
                            .quantidade_vendas ||
                        0
                    ),
                faturamento:
                    Number(
                        vendasOntem
                            .faturamento ||
                        0
                    )
            },

            estoque: {
                total_produtos:
                    Number(
                        estoque
                            .total_produtos ||
                        0
                    ),
                total_itens:
                    Number(
                        estoque
                            .total_itens ||
                        0
                    ),
                estoque_baixo:
                    Number(
                        estoque
                            .estoque_baixo ||
                        0
                    ),
                sem_estoque:
                    Number(
                        estoque
                            .sem_estoque ||
                        0
                    )
            }
        });
    } catch (erro) {
        console.error(
            "Erro ao carregar cards do dashboard:",
            erro
        );

        return res.status(500).json({
            sucesso: false,
            mensagem:
                "Não foi possível atualizar os cards do Dashboard."
        });
    }
});

module.exports = router;
