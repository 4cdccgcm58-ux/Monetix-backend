require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const { Resend } = require('resend')

const app = express()
app.use(cors())
app.use(express.json())

// ===============================
// ✅ CONEXIÓN A MONGODB
// ===============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => {
    console.error("❌ Error MongoDB:", err)
    process.exit(1)
  })

// ===============================
// ✅ CONFIGURACIÓN RESEND
// ===============================

const resend = new Resend(process.env.RESEND_API_KEY)

// ===============================
// ✅ MODELO DE RECUPERACIÓN
// ===============================
const recoverySchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL automático
  }
})

const RecoveryCode = mongoose.model("RecoveryCode", recoverySchema)

// ===============================
// ✅ ENDPOINT: REQUEST RESET
// ===============================
app.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.json({ success: false })
    }

    // Borra cualquier código anterior
    await RecoveryCode.deleteMany({ email })

    // Genera código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Expira en 10 minutos
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    // Guarda en MongoDB
    await RecoveryCode.create({
      email,
      code,
      expiresAt
    })

    // ✅ ENVÍO REAL CON RESEND
    await resend.emails.send({
      from: "Monetix <onboarding@resend.dev>",
      to: email,
      subject: "Recuperación de PIN - Monetix",
      html: `
        <h2>Recuperación de PIN</h2>
        <p>Tu código de recuperación es:</p>
        <h1>${code}</h1>
        <p>Este código vence en 10 minutos.</p>
      `
    })

    res.json({ success: true })

  } catch (error) {
    console.error("❌ Error request-reset:", error)
    res.status(500).json({ success: false })
  }
})

// ===============================
// ✅ ENDPOINT: VERIFY RESET
// ===============================
app.post('/verify-reset', async (req, res) => {
  try {
    const { email, code } = req.body

    if (!email || !code) {
      return res.json({ success: false })
    }

    const record = await RecoveryCode.findOne({ email, code })

    if (!record) {
      return res.json({ success: false })
    }

    // Borra los códigos después de usarlos
    await RecoveryCode.deleteMany({ email })

    res.json({ success: true })

  } catch (error) {
    console.error("❌ Error verify-reset:", error)
    res.status(500).json({ success: false })
  }
})

// ===============================
// ✅ SERVIDOR ACTIVO
// ===============================
const PORT = 3000
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`)
})

app.get("/test-email", async (req, res) => {
  try {
    const result = await resend.emails.send({
      from: "Monetix <onboarding@resend.dev>",
      to: "TU_CORREO_REAL@gmail.com", // <-- pon aquí TU CORREO
      subject: "Prueba Resend Monetix",
      html: "<h1>✅ Resend funcionando correctamente</h1>"
    })

    console.log("✅ Resultado Resend:", result)
    res.json({ success: true, result })

  } catch (error) {
    console.error("❌ Error Resend:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})
