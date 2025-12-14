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
    index: { expires: 0 }
  }
})

const RecoveryCode = mongoose.model("RecoveryCode", recoverySchema)

// ===============================
// ✅ ENDPOINT: REQUEST RESET
// ===============================
app.post('/request-reset', async (req, res) => {
  try {
    let { email } = req.body
    if (!email) return res.json({ success: false })

    email = email.trim().toLowerCase()

    await RecoveryCode.deleteMany({ email })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await RecoveryCode.create({
      email,
      code,
      expiresAt
    })

    await resend.emails.send({
      from: "Monetix <onboarding@resend.dev>", // mientras no tengas dominio
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
    let { email, code } = req.body
    if (!email || !code) return res.json({ success: false })

    email = email.trim().toLowerCase()
    code = code.trim()

    const record = await RecoveryCode.findOne({ email, code })
    if (!record) return res.json({ success: false })

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
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`)
})
