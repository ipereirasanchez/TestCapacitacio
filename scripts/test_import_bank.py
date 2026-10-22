import unittest

import io, json, os, tempfile, zipfile

from import_bank import parse_preguntas, parse_casos, date_from_zip_name, source_label, main

PM_SAMPLE = """COD: 1A01001
PREGUNTA: Si a una empresa de transportes le adeuda varias mensualidades de renta, ¿cómo debe proceder?
A: Formulando reclamación ante la Junta Arbitral de Transportes.
B: Formulando reclamación ante los Tribunales de Justicia.
C: Formulando reclamación en la Asociación de Propietarios e Inquilinos.
D: Cerrando las naves y solicitando la subasta judicial.
SOLUCION: B
NORMA: RD 1211/1990, art. 6

COD: 1A01002
PREGUNTA: ¿Qué es un arrendamiento?
A: Un pacto.
B: Un uso.
C: Una cesión.
D: Una venta.
SOLUCION: A
NORMA: Código Civil, art. 1543
"""

PM_SPLIT = """COD: 1F03040
PREGUNTA: ¿Puede realizar transporte un vehículo con permiso temporal?
A: Solo los vehículos ligeros.
B: 
Si, si se trata de pruebas o ensayos de investigación.
C: Solo si lo especifica el propio permiso.
D: Solo cuando vayan acompañados del boletín.
SOLUCION: B
NORMA: RD 2822/1998, art. 46
"""

CM_SAMPLE = """COD: 1A02001
PREGUNTA:

La agencia de transporte LAPAD contrata un transporte nacional de rollos de cable.
Como consecuencia de la falta de medios, el pedido se entrega con 24 horas de retraso.
Entre las instrucciones se hace incidencia en no utilizar autopistas de peaje.
A la llegada del vehículo a destino, el encargado se niega a descargar.
Responda a las siguientes cuestiones: ¿Tiene alguna responsabilidad la agencia? ¿Qué cantidad extra? ¿Tiene derecho a indemnización?


RESPUESTA A:
A) No, el transportista debe responder frente al cargador del contrato de la adecuación de los medios materiales aportados.
B) Tiene derecho a cobrar el coste del peaje.
C) Sí, al destinatario. 

RESPUESTA B:
A) Sí, responde frente a su cargador.
B) Ninguna.
C) Sí, a la agencia. 

RESPUESTA C:
A) No.
B) Ninguna.
C) Sí, a la agencia. 

RESPUESTA D:
A) No.
B) Sí.
C) Sí, a cualquiera.

RESPUESTA E:
A) Sí.
B) Tiene derecho.
C) Sí, a la agencia. 

RESPUESTA F:
A) Sí, solidariamente.
B) Ninguna.
C) Sí, al destinatario. 

RESPUESTA G:
A) Sí.
B) Tiene derecho.
C) Sí, al destinatario. 

RESPUESTA H:
A) Sí.
B) Tiene derecho a cobrar los gastos del peaje.
C) Sí, al destinatario. 

SOLUCION: RESPUESTA B

NORMA: Ley 15/2009, art. 36; OM FOM/1882/2012, Anexo, 4.1

"""

CM_SINGLE = """COD: 1B02002
PREGUNTA:

D.ª Felisa y D. Juan deciden constituir una sociedad colectiva.
Indique qué ganancias se deben atribuir a cada socio en ese año.


RESPUESTA A:
A D.ª Felisa, 19.714,28 euros; a D. Juan y al hijo, 13.142,86 euros a cada uno.

RESPUESTA B:
A D.ª Felisa, 16.560 euros.

RESPUESTA C:
A D.ª Felisa, 13.800 euros.

RESPUESTA D:
A D.ª Felisa y a D. Juan, 11.500 euros a cada uno.

RESPUESTA E:
15.333,33 euros a cada uno de los tres socios.

RESPUESTA F:
A D.ª Felisa, 27.600 euros.

RESPUESTA G:
A D.ª Felisa y a D. Juan, 23.000 euros a cada uno.

RESPUESTA H:
Nada.

SOLUCION: RESPUESTA F

NORMA: Código de Comercio, art. 140

REFERENCIA DOCTRINAL: Código de buenas prácticas, IRU

"""


PM_REF = """COD: 1B01005
PREGUNTA: ¿Qué es el Derecho mercantil?
A: Uno.
B: Dos.
C: Tres.
D: Cuatro.
SOLUCION: A
NORMA: Código de Comercio, art. 1
REFERENCIA DOCTRINAL: Derecho Mercantil, Rodrigo Uría, Editorial Marcial Pons
"""

CM_QUIRKS = """COD: 1F01029
PREGUNTA:

Enunciado breve.

RESPUESTA A:
A) Uno.
B) Dos.

RESPUESTA B:
A) B) Prefijo doblado.
B) Dos.

RESPUESTA C:
A) Uno.
B) Dos.

RESPUESTA D:
A) Uno.
B) Dos.

RESPUESTA E:
A) Uno.
B) Dos.

RESPUESTA F:
A) Uno.
B) Dos.

RESPUESTA G:
Respuesta G:
A) Uno.
B) Dos.

RESPUESTA H:
A) Uno.
B) Dos.

SOLUCION: RESPUESTA A

NORMA: Norma X
"""


class ParsePreguntas(unittest.TestCase):
    def test_referencia_doctrinal_is_split_from_norma(self):
        q = parse_preguntas(PM_REF, "B. Elementos de Derecho mercantil")[0]
        self.assertEqual(q["norma"], "Código de Comercio, art. 1")
        self.assertEqual(q["referencia"], "Derecho Mercantil, Rodrigo Uría, Editorial Marcial Pons")

    def test_referencia_is_none_when_absent(self):
        q = parse_preguntas(PM_SAMPLE, "A. Elementos de Derecho civil")[0]
        self.assertIsNone(q["referencia"])

    def test_basic_record(self):
        qs = parse_preguntas(PM_SAMPLE, "A. Elementos de Derecho civil")
        self.assertEqual(len(qs), 2)
        self.assertEqual(qs[0]["topic"], "A. Elementos de Derecho civil")
        self.assertEqual(qs[0]["code"], "1A01001")
        self.assertTrue(qs[0]["question"].startswith("Si a una empresa"))
        self.assertEqual([o["key"] for o in qs[0]["options"]], ["A", "B", "C", "D"])
        self.assertEqual(qs[0]["options"][1]["text"], "Formulando reclamación ante los Tribunales de Justicia.")
        self.assertEqual(qs[0]["answer"], "B")
        self.assertEqual(qs[0]["norma"], "RD 1211/1990, art. 6")
        self.assertEqual(qs[1]["code"], "1A01002")

    def test_continuation_line_joins_previous_field(self):
        q = parse_preguntas(PM_SPLIT, "F. Acceso a los mercados")[0]
        self.assertEqual(q["options"][1]["text"], "Si, si se trata de pruebas o ensayos de investigación.")
        self.assertEqual(len(q["options"]), 4)


class ParseCasos(unittest.TestCase):
    def test_scenario_keeps_paragraphs_across_blank_lines(self):
        cs = parse_casos(CM_SAMPLE, "A. Elementos de Derecho civil")
        self.assertEqual(len(cs), 1)
        c = cs[0]
        self.assertEqual(c["code"], "1A02001")
        self.assertEqual(len(c["scenario"]), 5)
        self.assertTrue(c["scenario"][0].startswith("La agencia"))
        self.assertEqual(c["answer"], "B")
        self.assertEqual([o["key"] for o in c["options"]], list("ABCDEFGH"))
        self.assertEqual(
            c["options"][0]["items"][0],
            "No, el transportista debe responder frente al cargador del contrato de la adecuación de los medios materiales aportados.",
        )
        self.assertEqual(len(c["options"][0]["items"]), 3)
        self.assertEqual(c["options"][7]["items"][2], "Sí, al destinatario.")
        self.assertEqual(c["norma"], "Ley 15/2009, art. 36; OM FOM/1882/2012, Anexo, 4.1")
        self.assertIsNone(c["referencia"])

    def test_single_line_alternative_and_referencia(self):
        c = parse_casos(CM_SINGLE, "B. Elementos de Derecho mercantil")[0]
        self.assertEqual(c["options"][4]["items"], ["15.333,33 euros a cada uno de los tres socios."])
        self.assertEqual(c["answer"], "F")
        self.assertEqual(c["referencia"], "Código de buenas prácticas, IRU")

    def test_source_quirks_doubled_prefix_and_stray_label_line(self):
        c = parse_casos(CM_QUIRKS, "F. Acceso a los mercados")[0]
        self.assertEqual(c["options"][1]["items"][0], "Prefijo doblado.")
        self.assertEqual(c["options"][6]["items"], ["Uno.", "Dos."])

    def test_duplicate_code_keeps_first(self):
        cs = parse_casos(CM_SAMPLE + "\n" + CM_SAMPLE, "A. Elementos de Derecho civil")
        self.assertEqual(len(cs), 1)


class MainGuard(unittest.TestCase):
    def _zip(self, path, files):
        with zipfile.ZipFile(path, "w") as zf:
            for name, text in files.items():
                zf.writestr(name, text)

    def test_main_refuses_to_write_when_a_bank_parses_empty(self):
        with tempfile.TemporaryDirectory() as d:
            pm = os.path.join(d, "pm_260326.zip"); cm = os.path.join(d, "cm_260326.zip")
            self._zip(pm, {"pm1A.txt": PM_SAMPLE})
            self._zip(cm, {"OTRO.txt": CM_SAMPLE})  # nombre no reconocido → 0 casos
            out = os.path.join(d, "out")
            rc = main(["--pm", pm, "--cm", cm, "--out", out])
            self.assertEqual(rc, 1)
            self.assertFalse(os.path.exists(os.path.join(out, "preguntas.json")))

    def test_main_writes_all_three_files(self):
        with tempfile.TemporaryDirectory() as d:
            pm = os.path.join(d, "pm_260326.zip"); cm = os.path.join(d, "cm_260326.zip")
            self._zip(pm, {"pm1A.txt": PM_SAMPLE})
            self._zip(cm, {"cm1A.txt": CM_SAMPLE})
            out = os.path.join(d, "out")
            self.assertEqual(main(["--pm", pm, "--cm", cm, "--out", out]), 0)
            meta = json.load(open(os.path.join(out, "meta.json"), encoding="utf-8"))
            self.assertEqual((meta["preguntas"], meta["casos"], meta["updated"]), (2, 1, "2026-03-26"))


class Misc(unittest.TestCase):
    def test_date_from_zip_name(self):
        self.assertEqual(date_from_zip_name("pm_260326.zip"), "2026-03-26")
        self.assertEqual(date_from_zip_name("/tmp/x/cm_260326.zip"), "2026-03-26")

    def test_source_label_keeps_urls_and_strips_local_dirs(self):
        self.assertEqual(source_label("https://cdn.example.es/x/pm_260326.zip"), "https://cdn.example.es/x/pm_260326.zip")
        self.assertEqual(source_label("/tmp/scratch/dl/pm/pm_260326.zip"), "pm_260326.zip")


if __name__ == "__main__":
    unittest.main()
