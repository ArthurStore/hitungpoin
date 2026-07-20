import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  teamName: String,
  placement: Number,
  kills: { type: Number, default: 0 },
  totalScore: Number,
  placementPoints: { type: Number, default: 0 },
  killPoints: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  isBooyah: { type: Boolean, default: false },
  mode: { type: String, enum: ['cr_biasa', 'cr_league'], default: 'cr_biasa' },
});

const matchSchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    matchNumber: { type: Number, required: true },
    map: String,
    inputMode: { type: String, enum: ['cr_biasa', 'cr_league'], default: 'cr_biasa' },
    status: { type: String, enum: ['pending', 'verified'], default: 'pending' },
    results: [resultSchema],
    ocrProcessed: { type: Boolean, default: false },
    verifiedAt: Date,
  },
  { timestamps: true }
);

matchSchema.index({ tournamentId: 1, matchNumber: 1 }, { unique: true });
export default mongoose.model('Match', matchSchema);
