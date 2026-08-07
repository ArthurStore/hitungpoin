export const uploadLogo = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filename = req.file.filename;
    const logoUrl = `/uploads/logos/${filename}`;
    return res.json({
      success: true,
      logoUrl,
      url: logoUrl,
      filename,
    });
  } catch (err) {
    console.error('uploadLogo error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
};

export const uploadCertificateTemplate = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filename = req.file.filename;
    const templateUrl = `/uploads/certificates/${filename}`;
    return res.json({
      success: true,
      templateUrl,
      url: templateUrl,
      filename,
    });
  } catch (err) {
    console.error('uploadCertificateTemplate error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
};
