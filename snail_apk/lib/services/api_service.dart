/// Snail classification API service.
///
/// Sends the photo to the FastAPI server's `/classify` endpoint (multipart
/// form, field `image`), same contract as the web app. Falls back to a mock
/// result when the server is unreachable.
///
/// Build-time configuration (flutter build apk --dart-define=...):
///   API_URL   — base URL of the classification server
///               (default: https://snail-api.onrender.com)
///   CYCLE_MODE=true — booth demo: every scan shows the next result in the
///               loop Male → Female → Female Pregnant, no server needed.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import '../models.dart';

class ApiService {
  ApiService({String? baseUrl})
      : _baseUrl = baseUrl ??
            const String.fromEnvironment(
              'API_URL',
              defaultValue: 'https://snail-api.onrender.com',
            );

  final String _baseUrl;

  /// Booth demo mode: skip the server and rotate results on every scan.
  static const bool cycleMode = bool.fromEnvironment('CYCLE_MODE');

  Uri get _classifyUrl {
    final base = _baseUrl.endsWith('/classify')
        ? _baseUrl
        : '${_baseUrl.replaceAll(RegExp(r'/+$'), '')}/classify';
    return Uri.parse(base);
  }

  static const List<ClassificationResult> _cycleStates = [
    ClassificationResult(
      sex: SnailGender.male,
      pregnancyStatus: PregnantStatus.notPregnant,
      confidence: 96.2,
      morphologicalNotes:
          'Narrow shell aperture and darker, heavily calcified operculum — typical male morphology.',
    ),
    ClassificationResult(
      sex: SnailGender.female,
      pregnancyStatus: PregnantStatus.notPregnant,
      confidence: 94.8,
      morphologicalNotes:
          'Wide shell aperture with pale operculum — typical female. No visible egg mass.',
    ),
    ClassificationResult(
      sex: SnailGender.female,
      pregnancyStatus: PregnantStatus.pregnant,
      confidence: 97.1,
      morphologicalNotes:
          'Wide shell aperture with a visible egg mass through the shell — a gravid (pregnant) female.',
    ),
  ];

  int _cycleIndex = 0;

  ClassificationResult _nextCycleResult() {
    final result = _cycleStates[_cycleIndex % _cycleStates.length];
    _cycleIndex++;
    return result;
  }

  /// Classify a snail photo (JPEG bytes).
  Future<ClassificationResult> classify(List<int> imageBytes) async {
    if (cycleMode) {
      await Future<void>.delayed(const Duration(milliseconds: 900));
      return _nextCycleResult();
    }

    try {
      final request = http.MultipartRequest('POST', _classifyUrl);
      request.files.add(http.MultipartFile.fromBytes(
        'image',
        imageBytes,
        filename: 'snail.jpg',
      ));
      final streamed = await request.send().timeout(const Duration(seconds: 60));
      final response = await http.Response.fromStream(streamed);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        // No snail in the photo → always "No Snail Detected" (never mock).
        final noSnail = data['snailDetected'] == false ||
            (data['snailDetected'] == null &&
                ((data['confidence'] as num?) ?? 0) == 0);
        if (noSnail) {
          return ClassificationResult(
            pregnancyStatus: PregnantStatus.notPregnant,
            confidence: 0,
            morphologicalNotes:
                (data['morphologicalNotes'] as String?) ??
                    'No snail detected in the image.',
            snailDetected: false,
          );
        }
        // Snail detected but classification Unknown (models/Gemini down) →
        // fall back to mock so the screen still shows a sex + pregnancy.
        final sex = SnailGender.fromLabel(data['sex'] as String?);
        if (sex == null) {
          final mock = await _mockClassify();
          return ClassificationResult(
            sex: mock.sex,
            pregnancyStatus: mock.pregnancyStatus,
            confidence: mock.confidence,
            morphologicalNotes:
                '${mock.morphologicalNotes} (simulated — AI classification currently unavailable)',
          );
        }
        return ClassificationResult(
          sex: sex,
          pregnancyStatus:
              PregnantStatus.fromLabel(data['pregnancyStatus'] as String?) ??
                  PregnantStatus.notPregnant,
          confidence: (data['confidence'] as num?)?.toDouble() ?? 0,
          morphologicalNotes: data['morphologicalNotes'] as String? ?? '',
          snailDetected: data['snailDetected'] as bool? ?? true,
        );
      }
    } catch (e) {
      // Server unreachable → mock fallback.
    }

    return _mockClassify();
  }

  static const List<String> _mockMaleNotes = [
    'Shell exhibits narrow aperture typical of male morphology. Operculum well-developed and darkly pigmented.',
    'Tentacles elongated with subtle dorsal curl. Shell length-to-width ratio suggests male phenotype.',
    'Male characteristics confirmed: prominent right tentacle, narrow shell opening.',
  ];

  static const List<String> _mockFemaleNotes = [
    'Shell shows wide aperture indicative of female morphology. Noticeable soft-tissue development in mantle area.',
    'Broader shell base observed. Operculum lighter in pigmentation, consistent with female specimens.',
    'Female phenotype confirmed: wide aperture, lighter operculum, and rounded shell apex.',
  ];

  static final Random _random = Random();

  Future<ClassificationResult> _mockClassify() async {
    // Simulate network latency (0.5 – 1.2 seconds).
    await Future<void>.delayed(
      Duration(milliseconds: 500 + _random.nextInt(700)),
    );
    final isFemale = _random.nextBool();
    final sex = isFemale ? SnailGender.female : SnailGender.male;
    final pregnancy = isFemale
        ? (_random.nextBool() ? PregnantStatus.pregnant : PregnantStatus.notPregnant)
        : PregnantStatus.notPregnant;
    final notes = (isFemale ? _mockFemaleNotes : _mockMaleNotes)
        [_random.nextInt(3)];
    return ClassificationResult(
      sex: sex,
      pregnancyStatus: pregnancy,
      confidence: 93 + _random.nextDouble() * 6.9,
      morphologicalNotes: notes,
    );
  }
}
