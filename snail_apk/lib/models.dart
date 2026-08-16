/// Data models for the Snail Sexing app (Flutter version).
library;

/// Male or Female.
enum SnailGender {
  male('Male'),
  female('Female');

  const SnailGender(this.label);
  final String label;

  static SnailGender? fromLabel(String? label) {
    for (final g in SnailGender.values) {
      if (g.label.toLowerCase() == (label ?? '').toLowerCase()) return g;
    }
    return null;
  }
}

/// Pregnant or Not Pregnant.
enum PregnantStatus {
  pregnant('Pregnant'),
  notPregnant('Not Pregnant');

  const PregnantStatus(this.label);
  final String label;

  static PregnantStatus? fromLabel(String? label) {
    for (final p in PregnantStatus.values) {
      if (p.label.toLowerCase() == (label ?? '').toLowerCase()) return p;
    }
    return null;
  }
}

/// A saved scan record, persisted on-device via shared_preferences.
class SnailRecord {
  const SnailRecord({
    required this.id,
    required this.photoBase64,
    required this.date,
    required this.gender,
    required this.pregnantStatus,
    required this.confidence,
    required this.morphologicalNotes,
    required this.createdAt,
  });

  final String id;
  /// JPEG bytes as base64 (no data-URL prefix) — compressed to ~480px/0.6 like
  /// the web app's compressImage() so records stay small.
  final String photoBase64;
  /// "yyyy-MM-dd" — the day the scan was taken.
  final String date;
  final SnailGender gender;
  final PregnantStatus pregnantStatus;
  /// 0–100.
  final double confidence;
  final String morphologicalNotes;
  final DateTime createdAt;

  SnailRecord copyWith({
    SnailGender? gender,
    PregnantStatus? pregnantStatus,
    double? confidence,
    String? morphologicalNotes,
  }) {
    return SnailRecord(
      id: id,
      photoBase64: photoBase64,
      date: date,
      gender: gender ?? this.gender,
      pregnantStatus: pregnantStatus ?? this.pregnantStatus,
      confidence: confidence ?? this.confidence,
      morphologicalNotes: morphologicalNotes ?? this.morphologicalNotes,
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'photoBase64': photoBase64,
        'date': date,
        'gender': gender.label,
        'pregnantStatus': pregnantStatus.label,
        'confidence': confidence,
        'morphologicalNotes': morphologicalNotes,
        'createdAt': createdAt.toIso8601String(),
      };

  static SnailRecord fromJson(Map<String, dynamic> json) => SnailRecord(
        id: json['id'] as String? ?? '',
        photoBase64: json['photoBase64'] as String? ?? '',
        date: json['date'] as String? ?? '',
        gender: SnailGender.fromLabel(json['gender'] as String?) ?? SnailGender.male,
        pregnantStatus:
            PregnantStatus.fromLabel(json['pregnantStatus'] as String?) ??
                PregnantStatus.notPregnant,
        confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
        morphologicalNotes: json['morphologicalNotes'] as String? ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
                DateTime.now(),
      );
}

/// The result of classifying a snail photo (from the FastAPI server or the
/// local mock / cycle fallback).
class ClassificationResult {
  const ClassificationResult({
    this.sex,
    required this.pregnancyStatus,
    required this.confidence,
    required this.morphologicalNotes,
    this.snailDetected = true,
  });

  /// null when the sex is Unknown (no snail detected or classification down).
  final SnailGender? sex;
  final PregnantStatus pregnancyStatus;
  /// 0–100.
  final double confidence;
  final String morphologicalNotes;
  /// false when the photo contains no snail → UI shows "No Snail Detected".
  final bool snailDetected;

  bool get noSnail => !snailDetected;
}

/// Aggregate counts for the Home screen.
class SnailCounts {
  const SnailCounts({
    required this.total,
    required this.male,
    required this.female,
    required this.pregnant,
  });

  final int total;
  final int male;
  final int female;
  final int pregnant;
}
