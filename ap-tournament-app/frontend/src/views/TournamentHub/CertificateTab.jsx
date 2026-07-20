import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Certificate, Download } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { generateAllCertificates, downloadDataUrl } from '../../utils/exportUtils';
import { api } from '../../utils/api';

export default function CertificateTab() {
  const { tournament } = useOutletContext();
  const [standings, setStandings] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.getLeaderboard(tournament._id).then((d) => setStandings(d.standings || []));
  }, [tournament._id]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const certs = await generateAllCertificates(tournament, standings);
      setCertificates(certs);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-white">Download Certificate</h2>
          <p className="text-xs text-slate-500">Auto-generate Juara 1, 2, 3</p>
        </div>
        <Button variant="gold" onClick={handleGenerate} loading={generating} disabled={standings.length < 1}>
          <Certificate size={18} /> Generate Certificates
        </Button>
      </div>

      {certificates.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-3">
          {certificates.map((cert) => (
            <div key={cert.rank} className="glass-panel overflow-hidden rounded-2xl">
              <div className="border-b border-white/5 px-4 py-2">
                <p className="text-sm font-bold text-gold">Juara {cert.rank} - {cert.teamName}</p>
              </div>
              <img src={cert.dataUrl} alt={`Juara ${cert.rank}`} className="w-full p-2" />
              <div className="p-3">
                <Button variant="ghost" size="sm" className="w-full"
                  onClick={() => downloadDataUrl(cert.dataUrl, `certificate-juara-${cert.rank}.png`)}>
                  <Download size={16} /> Download Certificate PNG
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {standings.length > 0 && certificates.length === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-slate-400">
          Top 3: {standings.slice(0, 3).map((s) => s.teamName).join(', ')}
        </div>
      )}
    </div>
  );
}
