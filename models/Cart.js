const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  nombre: String,
  precio: Number,
  cantidad: { type: Number, default: 1 },
  addedAt: { type: Date, default: Date.now }
});

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [itemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
