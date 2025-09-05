import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import BalanceMovement from "../models/BalanceMovement.js";

const walletController = {};

walletController.getWallet = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    const balanceMovements = await BalanceMovement.find({ user: user._id });

    res.status(200).json({ balance: user.balance, balanceMovements });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al obtener la billetera" });
  }
};

walletController.createWithdrawalRequest = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    const { amount, reason: comments, bank } = req.body;

    const withdrawal = new BalanceMovement({
      amount,
      type: 'withdrawal',
      user: user._id,
      comments,
      bank
    });

    await withdrawal.save();

    res.status(201).json({ message: "Solicitud de retiro creada", withdrawal });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al crear la solicitud de retiro" });
  }
};

walletController.getPendingMovements = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    const pendingMovements = await BalanceMovement.find({ user: user._id, status: 'pending' });

    res.status(200).json(pendingMovements);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al obtener los movimientos pendientes" });
  }
};

walletController.approveMovement = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    const { movementId } = req.params;
    console.log(movementId);

    const movement = await BalanceMovement.findOneAndUpdate(
      { _id: movementId, status: 'pending' },
      { status: 'completed' },
      { new: true }
    );

    if (!movement) {
      return res.status(404).json({ error: "Movimiento no encontrado o ya aprobado" });
    }

    await User.findByIdAndUpdate(user._id, { $inc: { balance: -movement.amount } });

    res.status(200).json({ message: "Movimiento aprobado", movement });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al aprobar el movimiento" });
  }
};

walletController.rejectMovement = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    const { movementId } = req.params;

    const movement = await BalanceMovement.findOneAndUpdate(
      { _id: movementId, status: 'pending' },
      { status: 'failed' },
      { new: true }
    );

    if (!movement) {
      return res.status(404).json({ error: "Movimiento no encontrado o ya aprobado" });
    }

    res.status(200).json({ message: "Movimiento rechazado", movement });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al rechazar el movimiento" });
  }
};

export default walletController;