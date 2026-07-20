import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  teamName: String,
  placement: { type: Number, min: 1, max: 12 },
  kills: { type: Number, default: 0 },
  placementPoints: { type: Number, default: 0 },
  killPoints: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  isBooyah: { type: Boolean, default: false },
});

const matchSchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    matchNumber: { type: Number, required: true },
    map: {
      type: String,
      enum: ['Bermuda', 'Purgatory', 'Kalahari', 'Nexterra', 'Alpine', 'Solara'],
      default: 'Bermuda',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'verified'],
      default: 'pending',
    },
    results: [resultSchema],
    ocrProcessed: { type: Boolean, default: false },
    screenshots: [String],
    verifiedAt: Date,
    verifiedBy: String,
  },
  { timestamps: true }
);

matchSchema.index({ tournamentId: 1, matchNumber: 1 }, { unique: true });

export default mongoose.model('Match', matchSchema);
