import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../theme.dart';

/// White bordered card row matching the web app's list tiles: photo in a mint
/// chip, gender + gender-colored pill, date · confidence, and an arrow.
class RecordTile extends StatelessWidget {
  const RecordTile({
    super.key,
    required this.record,
    required this.onTap,
    this.photoSize = 48,
  });

  final SnailRecord record;
  final VoidCallback onTap;
  final double photoSize;

  @override
  Widget build(BuildContext context) {
    final isMale = record.gender == SnailGender.male;
    final pillBg = isMale ? AppColors.maleBg : AppColors.femaleBg;
    final pillFg = isMale ? AppColors.maleFg : AppColors.femaleFg;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        padding: const EdgeInsets.all(16),
        decoration: appCardDecoration(),
        child: Row(
          children: [
            Container(
              width: photoSize,
              height: photoSize,
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(12),
              ),
              clipBehavior: Clip.antiAlias,
              child: record.photoBase64.isEmpty
                  ? const Icon(Icons.filter_vintage_rounded,
                      size: 24, color: AppColors.teal)
                  : Image.memory(base64Decode(record.photoBase64),
                      fit: BoxFit.cover),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(record.gender.label,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.gray900)),
                      const SizedBox(width: 8),
                      Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: pillBg,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          record.pregnantStatus.label,
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: pillFg),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today_rounded,
                          size: 12, color: AppColors.gray400),
                      const SizedBox(width: 4),
                      Text(DateFormat('MMM d, yyyy').format(record.createdAt),
                          style: AppText.muted),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Text('·', style: AppText.muted),
                      ),
                      Text('${record.confidence.toStringAsFixed(1)}%',
                          style: AppText.muted),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_rounded,
                size: 18, color: AppColors.gray300),
          ],
        ),
      ),
    );
  }
}
